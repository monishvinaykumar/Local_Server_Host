@echo off
setlocal
echo ========================================================
echo   Removing Local Dev Hub from Windows Startup
echo ========================================================
echo.

set SHORTCUT_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\DevHub.lnk

echo [1/2] Removing from Windows Registry (Run key)...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "DevHub" /f >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] DevHub removed from Windows Registry Run key.
) else (
    echo [INFO] DevHub was not found in Windows Registry Run key.
)

echo.
echo [2/2] Removing shortcut from Startup folder...
if exist "%SHORTCUT_PATH%" (
    del "%SHORTCUT_PATH%"
    echo [SUCCESS] DevHub shortcut removed from Windows Startup folder.
) else (
    echo [INFO] DevHub shortcut was not found in Startup folder.
)

echo.
echo ========================================================
echo   Dev Hub will no longer start automatically on boot.
echo ========================================================
echo.
pause
