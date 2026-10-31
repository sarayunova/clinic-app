<#
.SYNOPSIS
  Makes the clinic server start by itself when Windows starts (before anyone logs in), and restart if it stops.
.DESCRIPTION
  Creates one Windows scheduled task, "ClinicApp", that runs scripts\run-clinic.ps1 as the user who runs this installer.
  Run it in an elevated (administrator) PowerShell. Use -DryRun first to see exactly what would be created.
  Remove it again with scripts\uninstall-autostart.ps1.
#>
[CmdletBinding()]
param(
  # Where the app (this folder) is installed. Use a plain folder such as C:\ClinicApp, not OneDrive / Desktop.
  [string] $AppDir = '',
  # Where patient data lives. Default: the same place the app uses when started by hand.
  [string] $DataDir = $(if ($env:CLINIC_DATA_DIR) { $env:CLINIC_DATA_DIR } else { Join-Path $env:LOCALAPPDATA 'ClinicApp' }),
  [int]    $Port = 3080,
  # 127.0.0.1 = this computer only. Use 0.0.0.0 for tablets/phones, but only after HTTPS is set up (docs\HTTPS-SETUP.md).
  [string] $ListenHost = '127.0.0.1',
  [string] $BackupDir = '',
  # A file containing the backup passphrase (one line). Strongly recommended: without it automatic backups are off.
  [string] $BackupPassphraseFile = '',
  [string] $TlsDir = '',
  [string] $TaskName = 'ClinicApp',
  # Wait this long after Windows starts, so the network and disks are ready.
  [int]    $StartDelaySeconds = 30,
  [switch] $StartNow,
  [switch] $DryRun
)
$ErrorActionPreference = 'Stop'

function Fail([string] $m) { Write-Host "ERROR: $m" -ForegroundColor Red; exit 1 }
function Warn([string] $m) { Write-Host "WARNING: $m" -ForegroundColor Yellow }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin -and -not $DryRun) { Fail 'Run this in an administrator PowerShell (right-click PowerShell > Run as administrator), or add -DryRun to preview.' }

if (-not $AppDir) { $AppDir = Split-Path -Parent $PSScriptRoot }  # default: the folder this script is in, one level up
$AppDir = (Resolve-Path -LiteralPath $AppDir).Path
$run = Join-Path $AppDir 'scripts\run-clinic.ps1'
if (-not (Test-Path -LiteralPath $run)) { Fail "Cannot find $run" }
if (-not (Test-Path -LiteralPath (Join-Path $AppDir 'node_modules\tsx\dist\cli.mjs'))) { Fail "Dependencies are missing. Run 'npm ci' in $AppDir first." }
if (-not (Test-Path -LiteralPath (Join-Path $AppDir 'dist\web\index.html'))) { Warn "The web screens are not built. Run 'npm run build' in $AppDir, otherwise only the API will be served." }

$nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCmd) { Fail 'Node.js was not found. Install Node.js 24 or newer first.' }
$node = $nodeCmd.Source
$major = [int]((& $node --version).TrimStart('v').Split('.')[0])
if ($major -lt 24) { Fail "Node.js 24 or newer is required (found $(& $node --version))." }

# Things that commonly break an unattended start.
if ($AppDir -match 'OneDrive|\\Desktop\\|\\Documents\\') { Warn "$AppDir looks like a cloud-synced or personal folder. At startup those files may not be available yet. Install the app under a plain folder such as C:\ClinicApp." }
if ($DataDir -match 'OneDrive') { Warn "$DataDir is inside OneDrive. Patient records must not be stored in a cloud-synced folder." }
if ($BackupPassphraseFile) {
  if (-not (Test-Path -LiteralPath $BackupPassphraseFile)) { Fail "Backup passphrase file not found: $BackupPassphraseFile" }
  $BackupPassphraseFile = (Resolve-Path -LiteralPath $BackupPassphraseFile).Path
} else {
  Warn 'No -BackupPassphraseFile given: automatic backups will be OFF. The app will show a warning on screen.'
}
if ($ListenHost -ne '127.0.0.1' -and $ListenHost -ne 'localhost' -and -not $TlsDir -and -not (Test-Path -LiteralPath (Join-Path $DataDir 'tls\server.crt'))) {
  Warn 'Listening beyond this computer needs HTTPS certificates (docs\HTTPS-SETUP.md). Without them the server will refuse to start.'
}

$who = "$env:USERDOMAIN\$env:USERNAME"
$argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', "`"$run`"",
  '-AppDir', "`"$AppDir`"", '-DataDir', "`"$DataDir`"", '-Node', "`"$node`"", '-Port', $Port, '-ListenHost', $ListenHost)
if ($BackupDir) { $argList += @('-BackupDir', "`"$BackupDir`"") }
if ($BackupPassphraseFile) { $argList += @('-BackupPassphraseFile', "`"$BackupPassphraseFile`"") }
if ($TlsDir) { $argList += @('-TlsDir', "`"$TlsDir`"") }
$arguments = $argList -join ' '

Write-Host ''
Write-Host "Task name : $TaskName"
Write-Host "Runs as   : $who (no password stored; works with nobody logged in)"
Write-Host "Starts    : $StartDelaySeconds seconds after Windows starts, restarts itself if it stops"
Write-Host "Command   : powershell.exe $arguments"
Write-Host "Data      : $DataDir"
Write-Host "Logs      : $(Join-Path $DataDir 'logs')"
Write-Host ''
if ($DryRun) { Write-Host 'Dry run: nothing was created.'; exit 0 }

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory $AppDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT{0}S' -f $StartDelaySeconds
$principal = New-ScheduledTaskPrincipal -UserId $who -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1)

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Write-Host "Replacing the existing '$TaskName' task."
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings `
  -Description 'Clinic app server: starts with Windows and restarts if it stops.' | Out-Null
Write-Host "Installed. The clinic app will now start every time Windows starts." -ForegroundColor Green

if ($StartNow) {
  Start-ScheduledTask -TaskName $TaskName
  Write-Host 'Started. Give it about 15 seconds, then open http://127.0.0.1:' -NoNewline
  Write-Host $Port
}
