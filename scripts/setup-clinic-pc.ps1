<#
.SYNOPSIS
  One-time setup of the clinic server PC: checks, build, backup passphrase, HTTPS certificate, firewall, automatic start.
.DESCRIPTION
  Runs the steps from the deployment guide in order, using the app's own tools (npm run cert, install-autostart.ps1).
  Safe to run again: existing passphrase files, certificates and firewall rules are kept, not replaced.
  Run in an administrator PowerShell from the app folder. Use -DryRun first to see what it would do.

  Example:
    powershell -ExecutionPolicy Bypass -File scripts\setup-clinic-pc.ps1 -DryRun -BackupDir D:\ClinicBackups -ServerIp 192.168.1.20
#>
[CmdletBinding()]
param(
  # Folder for encrypted backups. Must be on a different disk from the data folder.
  [Parameter(Mandatory)] [string] $BackupDir,
  # The fixed address reserved for this PC in the router. Without it the certificate uses today's addresses.
  [string] $ServerIp = '',
  # Name staff type in the browser (https://<name>:3080). Default: this computer's name.
  [string] $ServerName = $env:COMPUTERNAME,
  [string] $AppDir = '',
  [string] $DataDir = $(if ($env:CLINIC_DATA_DIR) { $env:CLINIC_DATA_DIR } else { Join-Path $env:LOCALAPPDATA 'ClinicApp' }),
  # Holds backup-passphrase.txt, readable only by this Windows account, SYSTEM and administrators.
  [string] $SecretsDir = 'C:\ClinicSecrets',
  [int]    $Port = 3080,
  # Keep the app on this computer only: no certificate, no firewall rule, no tablets or phones.
  [switch] $LocalOnly,
  [switch] $SkipTests,
  [switch] $DryRun
)
$ErrorActionPreference = 'Stop'

$script:problems = 0
function Say([string] $m) { Write-Host $m }
function Step([string] $m) { Write-Host ''; Write-Host "== $m" -ForegroundColor Cyan }
function Ok([string] $m) { Write-Host "   ok: $m" -ForegroundColor Green }
function Warn([string] $m) { Write-Host "   WARNING: $m" -ForegroundColor Yellow }
function Would([string] $m) { Write-Host "   would: $m" -ForegroundColor DarkGray }
# A blocking problem: stops a real run; a dry run reports it and carries on so every problem is seen at once.
function Problem([string] $m) {
  $script:problems++
  if ($DryRun) { Write-Host "   WOULD STOP: $m" -ForegroundColor Red }
  else { Write-Host "ERROR: $m" -ForegroundColor Red; exit 1 }
}
function Run-Npm([string[]] $npmArgs) {
  if ($DryRun) { Would "npm $($npmArgs -join ' ')"; return }
  & npm @npmArgs
  if ($LASTEXITCODE -ne 0) { Problem "npm $($npmArgs -join ' ') failed (exit code $LASTEXITCODE)." }
}
function Read-NewSecret([string] $what, [int] $minLength) {
  while ($true) {
    $a = Read-Host -AsSecureString "   Enter the $what (at least $minLength characters)"
    $b = Read-Host -AsSecureString "   Type it again"
    $pa = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($a))
    $pb = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($b))
    if ($pa -ne $pb) { Warn 'The two entries differ. Try again.'; continue }
    if ($pa.Length -lt $minLength) { Warn "Too short. Use at least $minLength characters (a few random words is good)."; continue }
    return $pa
  }
}

if (-not $AppDir) { $AppDir = Split-Path -Parent $PSScriptRoot }
$AppDir = (Resolve-Path -LiteralPath $AppDir).Path
$DataDir = [IO.Path]::GetFullPath($DataDir)
$BackupDir = [IO.Path]::GetFullPath($BackupDir)
$passFile = Join-Path $SecretsDir 'backup-passphrase.txt'
$tlsDir = Join-Path $DataDir 'tls'
$listenHost = if ($LocalOnly) { '127.0.0.1' } else { '0.0.0.0' }
$me = "$env:USERDOMAIN\$env:USERNAME"

if ($DryRun) { Say 'DRY RUN: nothing will be changed.' }
Say "App folder    : $AppDir"
Say "Data folder   : $DataDir"
Say "Backup folder : $BackupDir"
Say "Secrets       : $passFile"
Say "Runs as       : $me"
if (-not $LocalOnly) { Say "Staff address : https://$($ServerName):$Port" }

# ---------------------------------------------------------------------------------------------------------------
Step '1/7  Checking this computer'
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) { Ok 'running as administrator' }
else { Problem 'Run this in an administrator PowerShell (right-click PowerShell > Run as administrator).' }

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { Problem 'Node.js is not installed. Install Node.js 24 (LTS) from nodejs.org, then open a new PowerShell.' }
else {
  $nodeVersion = (& $node.Source --version)
  if ([int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 24) { Problem "Node.js 24 or newer is required (found $nodeVersion)." }
  else { Ok "Node.js $nodeVersion" }
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Problem 'npm was not found. Reinstall Node.js with default options.' }

$cloud = '\\OneDrive( - [^\\]*)?(\\|$)'
if ($AppDir -match "$cloud|\\Desktop\\|\\Documents\\") { Problem "The app is in $AppDir. Move it to a plain folder such as C:\ClinicApp: cloud and personal folders may not be ready when Windows starts." }
else { Ok "app folder $AppDir" }
if ($DataDir -match $cloud) { Problem "The data folder $DataDir is inside OneDrive. Patient records must not be in a cloud-synced folder." }
if ($BackupDir -match $cloud) { Problem "The backup folder $BackupDir is inside OneDrive. Use a second local disk." }
if ([IO.Path]::GetPathRoot($BackupDir) -eq [IO.Path]::GetPathRoot($DataDir)) {
  Warn "Backups ($BackupDir) are on the same disk as the data ($DataDir). A failed disk would lose both. Use a second disk."
} else { Ok 'backups are on a different disk from the data' }

$os = (Get-CimInstance Win32_OperatingSystem).Caption
if ($os -match 'Home') { Warn "$os has no BitLocker. Windows Pro is recommended for disk encryption." } else { Ok $os }
try {
  $sys = Get-BitLockerVolume -MountPoint $env:SystemDrive -ErrorAction Stop
  if ($sys.ProtectionStatus -ne 'On') { Warn "BitLocker is OFF on $env:SystemDrive. Turn it on before real patient data is entered." }
  else { Ok "BitLocker on $env:SystemDrive" }
} catch { Warn 'Could not read BitLocker status (needs administrator rights). Check it in Control Panel.' }

if (-not $LocalOnly) {
  $public = @(Get-NetConnectionProfile -ErrorAction SilentlyContinue | Where-Object { $_.NetworkCategory -eq 'Public' })
  if ($public.Count -gt 0) { Warn "Network '$($public[0].Name)' is set to Public. Set it to Private, or tablets cannot reach the app." }
  else { Ok 'network profile is not Public' }
  if (-not $ServerIp) { Warn 'No -ServerIp given. Reserve a fixed address for this PC in the router and pass it, or the certificate may stop matching.' }
}

# ---------------------------------------------------------------------------------------------------------------
Step '2/7  Installing and building the app'
Push-Location $AppDir
try {
  Run-Npm @('ci')
  Run-Npm @('run', 'build')
  if ($SkipTests) { Warn 'tests skipped (-SkipTests)' } else { Run-Npm @('test') }
} finally { Pop-Location }
if (-not $DryRun) { Ok 'installed, built and tested' }

# ---------------------------------------------------------------------------------------------------------------
Step '3/7  Backup passphrase and backup folder'
if (Test-Path -LiteralPath $passFile) {
  Ok "keeping the existing passphrase file $passFile"
} elseif ($DryRun) {
  Would "ask for a backup passphrase and save it in $passFile (readable only by $me, SYSTEM, Administrators)"
} else {
  New-Item -ItemType Directory -Force -Path $SecretsDir | Out-Null
  # Lock the folder down before the secret is written, so the file is never readable by others.
  & icacls $SecretsDir /inheritance:r /grant:r "$($me):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
  if ($LASTEXITCODE -ne 0) { Problem "Could not restrict access to $SecretsDir." }
  Say '   Choose the backup passphrase. Without it NO backup can ever be opened.'
  $secret = Read-NewSecret 'backup passphrase' 12
  # No byte-order mark: the server reads the file as UTF-8 and would treat a BOM as part of the passphrase.
  [IO.File]::WriteAllText($passFile, $secret, (New-Object Text.UTF8Encoding $false))
  $secret = $null
  Ok "saved to $passFile"
  Warn 'Write the passphrase on paper now and keep it sealed with the doctor, away from this PC.'
}
if (Test-Path -LiteralPath $BackupDir) { Ok "backup folder exists: $BackupDir" }
elseif ($DryRun) { Would "create $BackupDir" }
else { New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null; Ok "created $BackupDir" }

# ---------------------------------------------------------------------------------------------------------------
Step '4/7  HTTPS certificate'
if ($LocalOnly) {
  Say '   skipped (-LocalOnly): the app will only be reachable on this PC.'
} elseif (Test-Path -LiteralPath (Join-Path $tlsDir 'server.crt')) {
  Ok "keeping the existing certificate in $tlsDir (renew with: npm run cert)"
} else {
  $certArgs = @('run', 'cert', '--', '--name', $ServerName)
  if ($ServerIp) { $certArgs += @('--ip', $ServerIp) }
  if ($DryRun) {
    Would "ask for a CA passphrase, then: npm $($certArgs -join ' ')"
  } else {
    Say '   Choose the certificate passphrase. It is needed every 2 years to renew the certificate.'
    $env:CLINIC_CA_PASSPHRASE = Read-NewSecret 'certificate (CA) passphrase' 12
    $env:CLINIC_DATA_DIR = $DataDir
    Push-Location $AppDir
    try { Run-Npm $certArgs } finally {
      Pop-Location
      Remove-Item Env:CLINIC_CA_PASSPHRASE -ErrorAction SilentlyContinue
    }
    Ok "certificate created in $tlsDir"
  }
  # This PC's own browser must trust the clinic CA too (the doctor may use it).
  if ($DryRun) { Would "trust $tlsDir\ca.crt on this PC (Local Machine > Trusted Root)" }
  else {
    Import-Certificate -FilePath (Join-Path $tlsDir 'ca.crt') -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
    Ok 'this PC trusts the clinic certificate'
  }
}

# ---------------------------------------------------------------------------------------------------------------
Step '5/7  Windows Firewall'
$ruleName = 'Clinic app'
if ($LocalOnly) {
  Say '   skipped (-LocalOnly)'
} elseif (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue) {
  Ok "rule '$ruleName' already exists"
} elseif ($DryRun) {
  Would "allow TCP $Port inbound on Private networks only (rule '$ruleName')"
} else {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private | Out-Null
  Ok "TCP $Port allowed on Private networks only. Never forward this port on the router."
}

# ---------------------------------------------------------------------------------------------------------------
Step '6/7  Automatic start with Windows'
$autostart = @{ AppDir = $AppDir; DataDir = $DataDir; Port = $Port; ListenHost = $listenHost; BackupDir = $BackupDir }
if ((Test-Path -LiteralPath $passFile) -or -not $DryRun) { $autostart.BackupPassphraseFile = $passFile }
if ($DryRun) { $autostart.DryRun = $true } else { $autostart.StartNow = $true }
& (Join-Path $PSScriptRoot 'install-autostart.ps1') @autostart
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { Problem 'Installing the automatic start failed (see above).' }

# ---------------------------------------------------------------------------------------------------------------
Step '7/7  Waiting for the app to answer'
if ($DryRun) {
  Would "wait up to 60 seconds for the app on port $Port"
} else {
  $up = $false
  for ($i = 0; $i -lt 30 -and -not $up; $i++) {
    Start-Sleep -Seconds 2
    $tcp = New-Object Net.Sockets.TcpClient
    try { $tcp.Connect('127.0.0.1', $Port); $up = $true } catch { } finally { $tcp.Close() }
  }
  if ($up) { Ok "the app is running on port $Port" }
  else { Problem "The app did not start within 60 seconds. Look at $DataDir\logs\supervisor.log and server-*.err.log." }
}

# ---------------------------------------------------------------------------------------------------------------
Write-Host ''
if ($DryRun) {
  if ($script:problems -gt 0) { Write-Host "Dry run found $($script:problems) problem(s) that would stop the setup. Fix them and run it again." -ForegroundColor Red; exit 1 }
  Write-Host 'Dry run finished: no problems that would stop the setup. Run again without -DryRun.' -ForegroundColor Green
  exit 0
}
$open = if ($LocalOnly) { "http://127.0.0.1:$Port" } else { "https://$($ServerName):$Port" }
Write-Host "Setup complete. Open $open on this PC and create the doctor's account now." -ForegroundColor Green
Write-Host ''
Write-Host 'Still to do by hand (tick each in Clinic > Setup checklist):'
if (-not $LocalOnly) {
  Write-Host "  - Copy $tlsDir to a USB drive; keep it and the certificate passphrase away from this PC."
  Write-Host "  - Install $tlsDir\ca.crt on every staff PC, tablet and phone (docs\HTTPS-SETUP.md)."
  Write-Host '  - Reserve this PC''s IP address in the router, if not done already.'
}
Write-Host '  - Seal the backup passphrase on paper with the doctor.'
Write-Host '  - In the app: Clinic > Back up now, then copy the backup folder to an off-site USB drive.'
Write-Host '  - Restart this PC and check the app comes back without anyone logging in.'
Write-Host '  - BitLocker, UPS, and the BIOS setting "restore on AC power loss".'
