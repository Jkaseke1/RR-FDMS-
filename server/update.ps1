# =============================================================================
#  FDMS Bridge - Update Script
#  Pulls latest changes from GitHub and restarts the service
# =============================================================================

#Requires -RunAsAdministrator

param(
    [string]$InstallDir = "C:\FDMS\fdms-bridge",
    [string]$Branch = "main",
    [switch]$RestartService,
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  FDMS Bridge - Update from GitHub" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if directory exists and is a git repo
if (-not (Test-Path "$InstallDir\.git")) {
    Write-Host "❌ Not a git repository: $InstallDir" -ForegroundColor Red
    Write-Host "   Run deploy.ps1 first to set up." -ForegroundColor Gray
    exit 1
}

Push-Location $InstallDir
try {
    # Get current commit
    $currentCommit = git rev-parse --short HEAD
    Write-Host "Current version: $currentCommit" -ForegroundColor Gray
    
    # Fetch latest
    Write-Host "`nFetching latest changes..." -ForegroundColor Yellow
    git fetch origin $Branch
    
    # Check if updates available
    $localCommit = git rev-parse HEAD
    $remoteCommit = git rev-parse "origin/$Branch"
    
    if ($localCommit -eq $remoteCommit) {
        Write-Host "✅ Already up to date." -ForegroundColor Green
        if (-not $RestartService) {
            exit 0
        }
    } else {
        Write-Host "Updates available!" -ForegroundColor Green
        Write-Host "  Local:  $(git rev-parse --short $localCommit)" -ForegroundColor Gray
        Write-Host "  Remote: $(git rev-parse --short $remoteCommit)" -ForegroundColor Gray
        
        if ($CheckOnly) {
            Write-Host "`nRun without -CheckOnly to apply updates." -ForegroundColor Yellow
            exit 0
        }
        
        # Show what's changing
        Write-Host "`nChanges to be applied:" -ForegroundColor White
        git log --oneline "$localCommit..$remoteCommit" | ForEach-Object {
            Write-Host "  • $_" -ForegroundColor Gray
        }
        
        # Backup current state
        $backupDir = "C:\FDMS\backups\$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        Copy-Item "$InstallDir\.env" $backupDir -ErrorAction SilentlyContinue
        Copy-Item "C:\FDMS\state.json" $backupDir -ErrorAction SilentlyContinue
        Write-Host "`n✅ Backup created: $backupDir" -ForegroundColor Green
        
        # Pull changes
        Write-Host "`nApplying updates..." -ForegroundColor Yellow
        git reset --hard "origin/$Branch"
        Write-Host "✅ Code updated" -ForegroundColor Green
        
        # Restore .env (in case template overwrote it)
        if (Test-Path "$backupDir\.env") {
            Copy-Item "$backupDir\.env" "$InstallDir\.env" -Force
            Write-Host "✅ Restored .env from backup" -ForegroundColor Green
        }
        
        # Install any new dependencies
        Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
        npm install
        Write-Host "✅ Dependencies updated" -ForegroundColor Green
    }
    
    # Restart service if requested or if updates were applied
    if ($RestartService -or ($localCommit -ne $remoteCommit)) {
        Write-Host "`nRestarting service..." -ForegroundColor Yellow
        
        # Check if running as Windows Service
        $serviceName = "FDMSBridge"
        try {
            $service = Get-Service -Name $serviceName -ErrorAction Stop
            if ($service.Status -eq 'Running') {
                Restart-Service -Name $serviceName -Force
                Write-Host "✅ Windows Service restarted" -ForegroundColor Green
            } else {
                Start-Service -Name $serviceName
                Write-Host "✅ Windows Service started" -ForegroundColor Green
            }
        } catch {
            # Not a Windows Service, check for PM2
            try {
                $pm2List = pm2 list 2>$null
                if ($pm2List -match "fdms-bridge|index") {
                    pm2 restart all
                    Write-Host "✅ PM2 process restarted" -ForegroundColor Green
                } else {
                    Write-Host "⚠️  No service manager found. Please restart manually:" -ForegroundColor Yellow
                    Write-Host "   cd '$InstallDir'; node index.js" -ForegroundColor DarkCyan
                }
            } catch {
                Write-Host "⚠️  No service manager found. Please restart manually:" -ForegroundColor Yellow
                Write-Host "   cd '$InstallDir'; node index.js" -ForegroundColor DarkCyan
            }
        }
    }
    
    $newCommit = git rev-parse --short HEAD
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  ✅ Update Complete" -ForegroundColor Green
    Write-Host "  Version: $newCommit" -ForegroundColor Gray
    Write-Host "========================================" -ForegroundColor Cyan
    
} catch {
    Write-Host "`n❌ Update failed: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}
