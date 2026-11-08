<#
.SYNOPSIS
  Runs the clinic server and keeps it running: restarts it if it stops, and writes a log file.
  Started automatically by the "ClinicApp" scheduled task (see docs/AUTO-START.md). You can also run it by hand.
.DESCRIPTION
  Launches the packaged clinic.exe when one is present (installer-based deployments), or falls
  back to `node.exe` + `tsx` running server/index.ts from source (dev checkouts, docs/AUTO-START.md's
  original setup) when it isn't. Pass -ExePath to point at a specific executable explicitly.
#>
param(
  [Parameter(Mandatory)] [string] $AppDir,
  [Parameter(Mandatory)] [string] $DataDir,
  [string] $Node = 'node.exe',
  [string] $ExePath = '',
  [int]    $Port = 3080,
  [string] $ListenHost = '127.0.0.1',
  [string] $BackupDir = '',
  [string] $BackupPassphraseFile = '',
  [string] $TlsDir = '',
  [int]    $LogKeepDays = 30
)
$ErrorActionPreference = 'Stop'

$cli = Join-Path $AppDir 'node_modules\tsx\dist\cli.mjs'
$entry = Join-Path $AppDir 'server\index.ts'

if (-not $ExePath) {
  $defaultExe = Join-Path $AppDir 'clinic.exe'
  if (Test-Path -LiteralPath $defaultExe) { $ExePath = $defaultExe }
}
$useExe = [bool]$ExePath
if ($useExe) {
  if (-not (Test-Path -LiteralPath $ExePath)) { throw "Missing $ExePath" }
} else {
  foreach ($f in @($cli, $entry)) { if (-not (Test-Path -LiteralPath $f)) { throw "Missing $f - run 'npm ci' in $AppDir, or pass -ExePath to a packaged clinic.exe" } }
}

$logDir = Join-Path $DataDir 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# Settings reach the server only through its environment. Secrets are never written into the task:
# the backup passphrase stays in its own file, which the server reads.
$env:CLINIC_DATA_DIR = $DataDir
$env:PORT = "$Port"
$env:HOST = $ListenHost
if ($BackupDir) { $env:CLINIC_BACKUP_DIR = $BackupDir }
if ($BackupPassphraseFile) { $env:CLINIC_BACKUP_PASSPHRASE_FILE = $BackupPassphraseFile }
if ($TlsDir) { $env:CLINIC_TLS_DIR = $TlsDir }
$env:NODE_ENV = 'production'

function Write-Log([string] $msg) {
  $line = '{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $msg
  Add-Content -LiteralPath (Join-Path $logDir 'supervisor.log') -Value $line
  Write-Host $line
}

# Old logs are removed so they cannot fill the disk.
Get-ChildItem -LiteralPath $logDir -File -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$LogKeepDays) } |
  Remove-Item -Force -ErrorAction SilentlyContinue

Write-Log "Supervisor started (data: $DataDir, port: $Port, host: $ListenHost)"
$delay = 5
while ($true) {
  $day = Get-Date -Format 'yyyyMMdd'
  $started = Get-Date
  $p = if ($useExe) {
    Start-Process -FilePath $ExePath -ArgumentList @('server') -WorkingDirectory $AppDir `
          -RedirectStandardOutput (Join-Path $logDir "server-$day.out.log") `
          -RedirectStandardError (Join-Path $logDir "server-$day.err.log") `
          -NoNewWindow -PassThru
  } else {
    Start-Process -FilePath $Node -ArgumentList @("`"$cli`"", "`"$entry`"") -WorkingDirectory $AppDir `
          -RedirectStandardOutput (Join-Path $logDir "server-$day.out.log") `
          -RedirectStandardError (Join-Path $logDir "server-$day.err.log") `
          -NoNewWindow -PassThru
  }
  Write-Log "Server started (process $($p.Id))"
  $null = $p.Handle   # keeps the process handle so ExitCode is available after it exits
  $p.WaitForExit()
  $ran = [int]((Get-Date) - $started).TotalSeconds
  Write-Log "Server stopped with exit code $($p.ExitCode) after $ran seconds"
  # A server that dies straight away is retried more slowly, so a broken setup does not spin the CPU or flood the log.
  $delay = if ($ran -lt 60) { [Math]::Min($delay * 2, 120) } else { 5 }
  Write-Log "Restarting in $delay seconds"
  Start-Sleep -Seconds $delay
}
