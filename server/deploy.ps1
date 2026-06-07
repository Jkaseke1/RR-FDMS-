# =============================================================================
#  FDMS Bridge - Server Deployment Script
#  Run this on your Windows Server to deploy from GitHub
# =============================================================================

#Requires -RunAsAdministrator

param(
    [string]$InstallDir = "C:\FDMS\fdms-bridge",
    [string]$RepoUrl = "https://github.com/Jkaseke1/RR-FDMS-.git",
    [string]$Branch = "main",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  FDMS Bridge Server Deployment" -ForegroundColor Cyan
Write-Host "  Rapid Roots Investments (Pvt) Ltd" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. Check prerequisites
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "❌ Node.js not found. Please install Node.js 18+ first." -ForegroundColor Red
    Write-Host "   Download from: https://nodejs.org/" -ForegroundColor Gray
    exit 1
}
Write-Host "   ✅ Node.js $nodeVersion" -ForegroundColor Green

# Check Git
try {
    $gitVersion = git --version 2>$null
    if (-not $gitVersion) { throw }
    Write-Host "   ✅ $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git not found. Please install Git first." -ForegroundColor Red
    Write-Host "   Download from: https://git-scm.com/download/win" -ForegroundColor Gray
    exit 1
}

# Check OpenSSL (for certificate verification)
try {
    $opensslPath = "C:\Program Files\Git\usr\bin\openssl.exe"
    if (Test-Path $opensslPath) {
        Write-Host "   ✅ OpenSSL found (Git for Windows)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  OpenSSL not found - certificate verification will be skipped" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  OpenSSL check failed" -ForegroundColor Yellow
}

# 2. Clone or update repository
Write-Host "`n[2/6] Setting up application files..." -ForegroundColor Yellow

if (Test-Path "$InstallDir\.git") {
    Write-Host "   Repository exists. Pulling latest changes..." -ForegroundColor Gray
    Push-Location $InstallDir
    try {
        git fetch origin
        git reset --hard origin/$Branch
        Write-Host "   ✅ Updated to latest $Branch" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Git pull failed: $_" -ForegroundColor Red
        exit 1
    } finally {
        Pop-Location
    }
} else {
    if (Test-Path $InstallDir) {
        if (-not $Force) {
            Write-Host "   ⚠️  Directory exists but is not a git repo: $InstallDir" -ForegroundColor Yellow
            Write-Host "   Use -Force to delete and re-clone, or manually delete first." -ForegroundColor Yellow
            exit 1
        }
        Remove-Item -Recurse -Force $InstallDir
    }
    
    Write-Host "   Cloning repository..." -ForegroundColor Gray
    $parentDir = Split-Path $InstallDir -Parent
    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }
    
    try {
        git clone --branch $Branch --single-branch $RepoUrl $InstallDir
        Write-Host "   ✅ Cloned to $InstallDir" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Clone failed: $_" -ForegroundColor Red
        exit 1
    }
}

# 3. Install dependencies
Write-Host "`n[3/6] Installing dependencies..." -ForegroundColor Yellow
Push-Location $InstallDir
try {
    npm install
    Write-Host "   ✅ Dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "   ❌ npm install failed: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

# 4. Create directories
Write-Host "`n[4/6] Creating directory structure..." -ForegroundColor Yellow
$dirs = @(
    "$InstallDir\certs",
    "$InstallDir\logs",
    "C:\FDMS\unsigned",
    "C:\FDMS\signed",
    "C:\FDMS\failed",
    "C:\FDMS\logs"
)
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "   ✅ Created: $dir" -ForegroundColor Green
    }
}

# 5. Configure environment
Write-Host "`n[5/6] Environment configuration..." -ForegroundColor Yellow
$envFile = "$InstallDir\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "   ⚠️  .env file not found. Creating from template..." -ForegroundColor Yellow
    $exampleEnv = "$InstallDir\.env.production.example"
    if (Test-Path $exampleEnv) {
        Copy-Item $exampleEnv $envFile
        Write-Host "   ✅ Created .env from template" -ForegroundColor Green
        Write-Host "   ⚠️  IMPORTANT: Edit $envFile with your production credentials!" -ForegroundColor Magenta
        Write-Host "      Required: FDMS_DEVICE_ID, FDMS_ACTIVATION_KEY, CERT_PATH, CERT_PASSWORD" -ForegroundColor Magenta
    } else {
        Write-Host "   ❌ No .env template found. Please create .env manually." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ✅ .env exists (not overwritten)" -ForegroundColor Green
}

# 6. Verify certificates
Write-Host "`n[6/6] Verifying certificates..." -ForegroundColor Yellow
$certsDir = "$InstallDir\certs"
$requiredCerts = @("device.crt.pem", "device.key.pem", "RapidR-1.p12")
$allCertsPresent = $true
foreach ($cert in $requiredCerts) {
    $certPath = Join-Path $certsDir $cert
    if (Test-Path $certPath) {
        Write-Host "   ✅ $cert" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Missing: $cert" -ForegroundColor Red
        $allCertsPresent = $false
    }
}

if (-not $allCertsPresent) {
    Write-Host "`n⚠️  Some certificates are missing. Please copy them to $certsDir" -ForegroundColor Yellow
    Write-Host "   After copying, run: node scripts\resetForProduction.js" -ForegroundColor Gray
}

# 7. Setup complete
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ✅ Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`nInstall Directory: $InstallDir" -ForegroundColor Gray
Write-Host "`nNext Steps:" -ForegroundColor White
Write-Host "   1. Edit .env with production credentials:" -ForegroundColor Gray
Write-Host "      notepad '$envFile'" -ForegroundColor DarkCyan
Write-Host "   2. Reset state for production:" -ForegroundColor Gray
Write-Host "      node '$InstallDir\scripts\resetForProduction.js'" -ForegroundColor DarkCyan
Write-Host "   3. Open fiscal day:" -ForegroundColor Gray
Write-Host "      node '$InstallDir\scripts\openFiscalDayDirect.js'" -ForegroundColor DarkCyan
Write-Host "   4. Start the service:" -ForegroundColor Gray
Write-Host "      cd '$InstallDir'; node index.js" -ForegroundColor DarkCyan
Write-Host "   5. (Optional) Install as Windows Service:" -ForegroundColor Gray
Write-Host "      node '$InstallDir\setup-windows-service.js'" -ForegroundColor DarkCyan
Write-Host "`nUpdate anytime:" -ForegroundColor White
Write-Host "   cd '$InstallDir'; git pull; npm install; restart service" -ForegroundColor DarkCyan
Write-Host "`n========================================" -ForegroundColor Cyan
