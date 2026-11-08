<#
.SYNOPSIS
  Stops the clinic server's automatic start with Windows and stops it now. Patient data is not touched.
#>
param([string] $TaskName = 'ClinicApp')
$ErrorActionPreference = 'Stop'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Host 'ERROR: Run this in an administrator PowerShell.' -ForegroundColor Red; exit 1 }

if (-not (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue)) {
  Write-Host "No '$TaskName' task is installed."
} else {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Removed '$TaskName' scheduled task." -ForegroundColor Green
}

# Stop any running clinic processes
Stop-Process -Name clinic -Force -ErrorAction SilentlyContinue
Write-Host "The clinic app is stopped and will no longer start automatically with Windows. Your data was not touched." -ForegroundColor Green
