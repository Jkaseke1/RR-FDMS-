# Network Diagnostic and Repair Script for FDMS Bridge Server
# Run as Administrator

param(
    [switch]$FixDNS,
    [switch]$RenewDHCP,
    [switch]$ResetAdapter,
    [string]$LogPath = "C:\FDMS\logs\network-diagnostics.log"
)

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] [$Level] $Message"
    Write-Host $line
    $line | Out-File -FilePath $LogPath -Append -Encoding utf8
}

# Ensure log directory exists
$logDir = Split-Path $LogPath -Parent
if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

Write-Log "=== FDMS Bridge Network Diagnostics Started ===" "INFO"

# 1. Basic network info
Write-Log "--- Network Adapter Info ---" "INFO"
$adapter = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.HardwareInterface -eq $true } | Select-Object -First 1
if ($adapter) {
    Write-Log "Active adapter: $($adapter.Name) ($($adapter.InterfaceDescription))" "INFO"
    $ipConfig = Get-NetIPConfiguration -InterfaceAlias $adapter.Name
    Write-Log "IP Address: $($ipConfig.IPv4Address.IPAddress)" "INFO"
    Write-Log "Default Gateway: $($ipConfig.IPv4DefaultGateway.NextHop)" "INFO"
    Write-Log "DNS Servers: $($ipConfig.DnsServer.ServerAddresses -join ', ')" "INFO"
} else {
    Write-Log "No active hardware adapter found!" "ERROR"
}

# 2. DNS configuration
Write-Log "--- DNS Configuration ---" "INFO"
$dnsServers = Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object { $_.ServerAddresses }
foreach ($dns in $dnsServers) {
    Write-Log "$($dns.InterfaceAlias): $($dns.ServerAddresses -join ', ')" "INFO"
}

# 3. Test DNS resolution multiple times
Write-Log "--- DNS Resolution Test (fdmsapi.zimra.co.zw) ---" "INFO"
$failures = 0
$successes = 0
for ($i = 1; $i -le 10; $i++) {
    try {
        $result = Resolve-DnsName -Name "fdmsapi.zimra.co.zw" -Type A -ErrorAction Stop | Select-Object -First 1
        Write-Log "Attempt $i`: SUCCESS - $($result.IPAddress) (TTL: $($result.TTL))" "SUCCESS"
        $successes++
    } catch {
        Write-Log "Attempt $i`: FAILED - $($_.Exception.Message)" "ERROR"
        $failures++
    }
    Start-Sleep -Seconds 1
}
$dnsLevel = if ($failures -gt 0) { "WARN" } else { "SUCCESS" }
Write-Log "DNS test results: $successes success, $failures failure" $dnsLevel

# 4. TCP connectivity test
Write-Log "--- TCP Connectivity Test (port 443) ---" "INFO"
try {
    $tcp = Test-NetConnection -ComputerName "fdmsapi.zimra.co.zw" -Port 443 -WarningAction SilentlyContinue
    $tcpLevel = if ($tcp.TcpTestSucceeded) { "SUCCESS" } else { "ERROR" }
    Write-Log "TCP Test: RemoteAddress=$($tcp.RemoteAddress) TcpTestSucceeded=$($tcp.TcpTestSucceeded)" $tcpLevel
} catch {
    Write-Log "TCP Test failed: $($_.Exception.Message)" "ERROR"
}

# 5. ARP table - look for duplicate IPs
Write-Log "--- ARP Table (looking for duplicate IPs) ---" "INFO"
$arpOutput = arp -a
$conflictIPs = @("192.168.100.246", "192.168.100.160")
foreach ($ip in $conflictIPs) {
    $arpMatches = $arpOutput | Select-String $ip
    if ($arpMatches) {
        Write-Log "Found ARP entries for $ip`:" "WARN"
        $arpMatches | ForEach-Object { Write-Log $_.Line "WARN" }
    } else {
        Write-Log "No ARP entry found for $ip" "INFO"
    }
}

# 6. Check DHCP lease
Write-Log "--- DHCP Lease Info ---" "INFO"
try {
    $dhcp = Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration -Filter "IPEnabled = True" | Select-Object -First 1
    Write-Log "DHCP Enabled: $($dhcp.DHCPEnabled)" "INFO"
    Write-Log "DHCP Server: $($dhcp.DHCPServer)" "INFO"
} catch {
    Write-Log "Could not get DHCP info: $($_.Exception.Message)" "WARN"
}

# 7. ESET check
Write-Log "--- Antivirus/Firewall Check ---" "INFO"
try {
    $av = Get-WmiObject -Namespace root\SecurityCenter2 -Class AntiVirusProduct -ErrorAction Stop
    foreach ($product in $av) {
        Write-Log "AV Product: $($product.displayName) (state: $($product.productState))" "INFO"
    }
} catch {
    Write-Log "Could not query antivirus: $($_.Exception.Message)" "WARN"
}

# 8. Windows Firewall outbound rules
Write-Log "--- Outbound Firewall Rules (enabled) ---" "INFO"
$outboundRules = Get-NetFirewallRule | Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Outbound' -and $_.Action -eq 'Block' }
$fwLevel = if ($outboundRules.Count -gt 0) { "WARN" } else { "SUCCESS" }
Write-Log "Outbound blocking rules count: $($outboundRules.Count)" $fwLevel

# 9. APPLY FIXES (only if switches provided)
if ($FixDNS) {
    Write-Log "Applying DNS fix (Google + Cloudflare)..." "INFO"
    try {
        $activeAdapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.HardwareInterface -eq $true }
        foreach ($na in $activeAdapters) {
            Set-DnsClientServerAddress -InterfaceAlias $na.Name -ServerAddresses @("8.8.8.8", "1.1.1.1") -ErrorAction Stop
            Write-Log "Set DNS on $($na.Name) to 8.8.8.8, 1.1.1.1" "SUCCESS"
        }
    } catch {
        Write-Log "DNS fix failed: $($_.Exception.Message)" "ERROR"
    }
}

if ($RenewDHCP) {
    Write-Log "Renewing DHCP lease..." "INFO"
    try {
        ipconfig /release | Out-Null
        ipconfig /renew | Out-Null
        Write-Log "DHCP lease renewed" "SUCCESS"
    } catch {
        Write-Log "DHCP renew failed: $($_.Exception.Message)" "ERROR"
    }
}

if ($ResetAdapter) {
    Write-Log "Resetting network adapter..." "INFO"
    try {
        $activeAdapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.HardwareInterface -eq $true }
        foreach ($na in $activeAdapters) {
            Disable-NetAdapter -Name $na.Name -Confirm:$false
            Start-Sleep -Seconds 2
            Enable-NetAdapter -Name $na.Name -Confirm:$false
            Write-Log "Reset adapter $($na.Name)" "SUCCESS"
        }
    } catch {
        Write-Log "Adapter reset failed: $($_.Exception.Message)" "ERROR"
    }
}

Write-Log "=== Diagnostics Complete ===" "INFO"
Write-Log "Log saved to: $LogPath" "INFO"

# Recommendations
Write-Log "--- Recommendations ---" "INFO"
if ($failures -gt 0) {
    Write-Log "DNS is unstable. Consider: FixDNS switch, check router DHCP, resolve duplicate IPs." "WARN"
}
if ($outboundRules.Count -gt 0) {
    Write-Log "There are outbound firewall blocking rules. Review them if FDMS traffic is blocked." "WARN"
}
Write-Log "For ESET: add exclusions for C:\Program Files\nodejs\node.exe and C:\fdms-bridge" "INFO"
Write-Log "For duplicate IPs: check router DHCP reservations and assign unique static IPs." "INFO"
