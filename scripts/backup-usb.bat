@echo off
setlocal
title LiVi Clinic - USB Flash Drive Backup Utility

cls
echo ===============================================================================
echo             LiVi CLINIC - USB FLASH DRIVE AUTOMATED BACKUP
echo ===============================================================================
echo.
echo Please ensure your clinic USB drive is plugged into the computer.
echo.

npx tsx scripts/backup-usb.ts %*

if %ERRORLEVEL% equ 0 (
    echo Backup completed successfully.
) else (
    echo [ERROR] Backup failed. Review the error details above.
)

echo.
pause
