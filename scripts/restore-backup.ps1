<#
.SYNOPSIS
  Restores the clinic database from an encrypted backup (.cbk), safely, with nothing lost if it goes wrong.
.DESCRIPTION
  Run in an administrator PowerShell. The System status > Restore page in the app gives the exact command
  for a backup after checking it. Steps:
    1. Copies the backup to the data folder and checks it (decrypts a temporary copy; live data untouched).
    2. Shows what is in it and asks you to type RESTORE.
    3. Stops the clinic server gracefully.
    4. Takes an encrypted safety copy of the current database (into <data folder>\pre-upgrade).
    5. Replaces the database. The current one is also kept beside it as clinic.sqlite.before-restore-*,
       and is put back automatically if the restored database fails to open.
    6. Starts the server again and checks it answers.
  A log of every step (no passphrases) is written to <data folder>\logs\restore-<time>.log.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File C:\ClinicApp\scripts\restore-backup.ps1 -Backup D:\ClinicBackups\clinic-20261116T163743Z.cbk
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string] $Backup,
  [string] $PassphraseFile = (Join-Path $env:ProgramData 'ClinicApp\secrets\backup-passphrase.txt'),
  [string] $TaskName = 'ClinicApp'
)
$ErrorActionPreference = 'Stop'

function Say([string] $m, [string] $color = 'Gray') { Write-Host $m -ForegroundColor $color }
function Fail([string] $m) { Say "STOPPED: $m" Red; exit 1 }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Fail 'Run this in an administrator PowerShell (right-click PowerShell > Run as administrator).' }

$appDir = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $appDir 'clinic.exe'
if (-not (Test-Path -LiteralPath $exe)) { Fail "Cannot find $exe." }
if (-not (Test-Path -LiteralPath $Backup)) { Fail "Cannot find the backup file $Backup." }
if (-not (Test-Path -LiteralPath $PassphraseFile)) { Fail "Cannot find the backup passphrase file $PassphraseFile." }

# Use exactly the data folder the automatic-start task uses, so the restore lands where the server reads.
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
  $m = [regex]::Match($task.Actions[0].Arguments, '-DataDir\s+"([^"]+)"')
  if ($m.Success) { $env:CLINIC_DATA_DIR = $m.Groups[1].Value }
}
$dataDir = if ($env:CLINIC_DATA_DIR) { $env:CLINIC_DATA_DIR } else { Join-Path $env:ProgramData 'ClinicApp' }
$env:CLINIC_BACKUP_PASSPHRASE_FILE = $PassphraseFile

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
New-Item -ItemType Directory -Force -Path (Join-Path $dataDir 'logs') | Out-Null
Start-Transcript -Path (Join-Path $dataDir "logs\restore-$stamp.log") | Out-Null
$serverStopped = $false
# A private copy of the backup: the safety copy in step 4 prunes old pre-upgrade copies (which could be
# the very file being restored), and a USB drive could be pulled out halfway.
$source = Join-Path $dataDir "restore-source-$stamp.cbk"
try {
  Say "Data folder: $dataDir"
  Say "Backup:      $Backup"
  Copy-Item -LiteralPath $Backup -Destination $source

  Say "`n[1/5] Checking the backup (the live records are not touched)..." Cyan
  & $exe restore $source --check
  if ($LASTEXITCODE -ne 0) { Fail 'The backup did not pass its check (see above). Nothing was changed.' }

  Say "`nThis REPLACES every record in the clinic with the contents of this backup." Yellow
  Say 'Anything entered after the backup was taken will no longer appear (the current database is kept as a file, not deleted).' Yellow
  $answer = Read-Host 'Type RESTORE to continue, anything else to cancel'
  if ($answer -cne 'RESTORE') { Fail 'Cancelled. Nothing was changed.' }

  Say "`n[2/5] Stopping the clinic server..." Cyan
  if ($task) { Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue }
  $serverStopped = $true
  & $exe request-stop --timeout 60
  if ($LASTEXITCODE -ne 0) { Fail 'The server did not stop within 60 seconds. Nothing was changed; it will be started again.' }

  Say "`n[3/5] Taking an encrypted safety copy of the current database..." Cyan
  & $exe snapshot --passphrase-file $PassphraseFile
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 2) { Fail 'The safety copy failed (see above). Nothing was changed; the server will be started again.' }

  Say "`n[4/5] Restoring..." Cyan
  & $exe restore $source --replace
  if ($LASTEXITCODE -ne 0) { Fail 'The restore did not complete (see above). The previous database is still in place; the server will be started again.' }
  Say 'Restore complete.' Green
} finally {
  Remove-Item -LiteralPath $source -Force -ErrorAction SilentlyContinue
  if ($serverStopped) {
    Say "`n[5/5] Starting the clinic server again..." Cyan
    if ($task) {
      Start-ScheduledTask -TaskName $TaskName
      & $exe health --timeout 90
      if ($LASTEXITCODE -eq 0) { Say 'The clinic server is running.' Green }
      else { Say 'WARNING: the server did not answer. Restart the computer; if it still does not start, see the logs folder.' Red }
    } else {
      Say "No '$TaskName' task: start the clinic app the way it is normally started on this computer." Yellow
    }
  }
  Say "A log of these steps is in $(Join-Path $dataDir "logs\restore-$stamp.log")."
  Stop-Transcript | Out-Null
}
