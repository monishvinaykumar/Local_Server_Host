@echo off
setlocal
echo ========================================================
echo   Stopping Local Dev Hub and Active Projects
echo ========================================================
echo.

powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5555, 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force; Write-Host ('Stopped process PID: ' + $_) }"

echo.
echo All stopped cleanly.
timeout /t 2 >nul
