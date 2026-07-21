# ESET Exclusion Helper for FDMS Bridge
# ESET does not expose a stable PowerShell API for exclusions, so this script
# detects ESET, prints the exact manual steps, and opens the ESET GUI.

param(
    [string]$LogPath = "C:\FDMS\logs\eset-exclusions.log"
)

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] [$Level] $Message"
    Write-Host $line
    $line | Out-File -FilePath $LogPath -Append -Encoding utf8
}

$logDir = Split-Path $LogPath -Parent
if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

Write-Log "=== ESET Exclusion Helper Started ===" "INFO"

$pathsToExclude = @(
    "C:\Program Files\nodejs\node.exe",
    "C:\fdms-bridge"
)

Write-Log "Paths to exclude from ESET scanning:" "INFO"
foreach ($p in $pathsToExclude) {
    $exists = if (Test-Path $p) { "EXISTS" } else { "NOT FOUND" }
    Write-Log "  - $p ($exists)" "INFO"
}

# Try to find ESET GUI executable
$esetPaths = @(
    "${env:ProgramFiles}\ESET\ESET Security\ecp.exe",
    "${env:ProgramFiles}\ESET\ESET NOD32 Antivirus\ecp.exe",
    "${env:ProgramFiles}\ESET\ESET Internet Security\ecp.exe",
    "${env:ProgramFiles}\ESET\ESET Smart Security Premium\ecp.exe",
    "${env:ProgramFiles(x86)}\ESET\ESET Security\ecp.exe",
    "${env:ProgramFiles(x86)}\ESET\ESET NOD32 Antivirus\ecp.exe",
    "${env:ProgramFiles(x86)}\ESET\ESET Internet Security\ecp.exe",
    "${env:ProgramFiles(x86)}\ESET\ESET Smart Security Premium\ecp.exe"
)

$foundEset = $false
foreach ($path in $esetPaths) {
    if (Test-Path $path) {
        Write-Log "Found ESET GUI: $path" "SUCCESS"
        try {
            Start-Process -FilePath $path -ErrorAction Stop
            Write-Log "Opened ESET GUI." "SUCCESS"
            $foundEset = $true
            break
        } catch {
            Write-Log "Failed to open ESET GUI: $($_.Exception.Message)" "ERROR"
        }
    }
}

if (-not $foundEset) {
    Write-Log "Could not find ESET GUI executable automatically." "WARN"
}

Write-Log "" "INFO"
Write-Log "=== Manual steps to add exclusions ===" "INFO"
Write-Log "1. Open ESET Security (click the icon in system tray or search 'ESET')." "INFO"
Write-Log "2. Press F5 or click Setup -> Advanced setup." "INFO"
Write-Log "3. Expand Computer protection -> Real-time file system protection." "INFO"
Write-Log "4. Click 'Configure exclusions...'." "INFO"
Write-Log "5. Click 'Add...' and add each of the following:" "INFO"
foreach ($p in $pathsToExclude) {
    Write-Log "      $p" "INFO"
}
Write-Log "6. Ensure the checkboxes for Scan, AMSI, and HIPS are selected for each exclusion." "INFO"
Write-Log "7. Click OK to save." "INFO"
Write-Log "8. Restart the FDMS service if desired: Restart-Service -Name 'FDMS PDF Watcher'" "INFO"
Write-Log "=== End of manual steps ===" "INFO"
Write-Log "Log saved to: $LogPath" "INFO"
