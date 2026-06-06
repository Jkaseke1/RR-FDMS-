# ZIMRA FDMS Bridge - Server Setup Script
# Run this script as Administrator on the production server

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ZIMRA FDMS Bridge - Server Setup" -ForegroundColor Cyan
Write-Host "Rapid Roots Investments (Pvt) Ltd" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Running with Administrator privileges" -ForegroundColor Green
Write-Host ""

# Step 1: Check Node.js installation
Write-Host "Step 1: Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js is installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed" -ForegroundColor Red
    Write-Host "Please download and install Node.js LTS from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Step 2: Create directory structure
Write-Host "Step 2: Creating directory structure..." -ForegroundColor Yellow
$directories = @(
    "C:\FDMS",
    "C:\FDMS\unsigned",
    "C:\FDMS\signed",
    "C:\FDMS\failed",
    "C:\FDMS\logs"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "✅ Created: $dir" -ForegroundColor Green
    } else {
        Write-Host "✓ Exists: $dir" -ForegroundColor Gray
    }
}
Write-Host ""

# Step 3: Install npm dependencies
Write-Host "Step 3: Installing npm dependencies..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Gray
try {
    npm install --production
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Check for .env file
Write-Host "Step 4: Checking configuration..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "✅ Created .env from .env.example" -ForegroundColor Green
        Write-Host "⚠️  IMPORTANT: Edit .env file with production values!" -ForegroundColor Yellow
        Write-Host "   - DEVICE_ID" -ForegroundColor Yellow
        Write-Host "   - DEVICE_SERIAL" -ForegroundColor Yellow
        Write-Host "   - CERT_PASSWORD" -ForegroundColor Yellow
        Write-Host "   - SUPABASE credentials (if using)" -ForegroundColor Yellow
    } else {
        Write-Host "❌ .env.example not found" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ .env file exists" -ForegroundColor Green
}
Write-Host ""

# Step 5: Check certificates
Write-Host "Step 5: Checking certificates..." -ForegroundColor Yellow
if (Test-Path "certs\*.p12") {
    Write-Host "✅ Certificate files found" -ForegroundColor Green
} else {
    Write-Host "⚠️  No .p12 certificate files found in certs\ directory" -ForegroundColor Yellow
    Write-Host "Please copy your ZIMRA certificate to certs\ directory" -ForegroundColor Yellow
}
Write-Host ""

# Step 6: Test configuration
Write-Host "Step 6: Testing configuration..." -ForegroundColor Yellow
Write-Host "Running connection test..." -ForegroundColor Gray
try {
    node scripts/testConnection.js
    Write-Host "✅ Configuration test passed" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Configuration test failed" -ForegroundColor Yellow
    Write-Host "This is normal if certificates are not yet configured" -ForegroundColor Gray
}
Write-Host ""

# Step 7: Setup Windows Service
Write-Host "Step 7: Windows Service Setup" -ForegroundColor Yellow
Write-Host "Do you want to install ZIMRA FDMS Bridge as a Windows Service?" -ForegroundColor Cyan
Write-Host "This will make it start automatically on server boot." -ForegroundColor Gray
$installService = Read-Host "Install as service? (Y/N)"

if ($installService -eq "Y" -or $installService -eq "y") {
    Write-Host "Installing node-windows package..." -ForegroundColor Gray
    npm install -g node-windows
    
    Write-Host "Installing Windows Service..." -ForegroundColor Gray
    node setup-windows-service.js
    
    Write-Host "✅ Service installation complete" -ForegroundColor Green
} else {
    Write-Host "⏭️  Skipped service installation" -ForegroundColor Gray
    Write-Host "You can install later by running: node setup-windows-service.js" -ForegroundColor Yellow
}
Write-Host ""

# Step 8: Create backup script
Write-Host "Step 8: Creating backup script..." -ForegroundColor Yellow
$backupScript = @'
# FDMS Backup Script
$BackupDir = "D:\Backups\FDMS\$(Get-Date -Format 'yyyy-MM-dd')"
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

Write-Host "Backing up FDMS files to $BackupDir..."

Copy-Item "C:\FDMS\state.json" $BackupDir -ErrorAction SilentlyContinue
Copy-Item "C:\FDMS\signed\*" "$BackupDir\signed\" -Recurse -ErrorAction SilentlyContinue
Copy-Item "C:\FDMS\logs\*" "$BackupDir\logs\" -Recurse -ErrorAction SilentlyContinue
Copy-Item "C:\FDMS\fdms-bridge\.env" $BackupDir -ErrorAction SilentlyContinue

Write-Host "✅ Backup complete: $BackupDir"

# Delete backups older than 30 days
Get-ChildItem "D:\Backups\FDMS" -Directory | Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Recurse -Force

Write-Host "✅ Old backups cleaned up"
'@

$backupScript | Out-File -FilePath "backup-fdms.ps1" -Encoding UTF8
Write-Host "✅ Created backup-fdms.ps1" -ForegroundColor Green
Write-Host "Schedule this script in Task Scheduler for daily backups" -ForegroundColor Yellow
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Edit .env file with production credentials" -ForegroundColor White
Write-Host "2. Copy ZIMRA certificate to certs\ directory" -ForegroundColor White
Write-Host "3. Test connection: node scripts/testConnection.js" -ForegroundColor White
Write-Host "4. Configure Sage 200 to print PDFs to C:\FDMS\unsigned\" -ForegroundColor White
Write-Host "5. Start the service or run: node index.js" -ForegroundColor White
Write-Host ""
Write-Host "Documentation: See DEPLOYMENT_GUIDE.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
