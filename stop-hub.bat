@echo off
setlocal
echo ========================================================
echo   Stopping Local Dev Hub (Port 5555)
echo ========================================================
echo.

powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5555 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force; Write-Host ('Stopped process PID: ' + $_) }"

echo.
echo Dev Hub stopped.
pause
