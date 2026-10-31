<#
.SYNOPSIS
  Stops the clinic server's automatic start with Windows and stops it now. Patient data is not touched.
#>
param([string] $TaskName = 'ClinicApp')
$ErrorActionPreference = 'Stop'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Host 'ERROR: Run this in an administrator PowerShell.' -ForegroundColor Red; exit 1 }

if (-not (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue)) {
  Write-Host "No '$TaskName' task is installed. Nothing to do."
  exit 0
}
Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Removed '$TaskName'. The clinic app will no longer start with Windows. Your data was not touched." -ForegroundColor Green
