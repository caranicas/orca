@echo off
powershell.exe -NoLogo -NoProfile -File "%~dp0start-orca-custom.ps1"
if errorlevel 1 pause
