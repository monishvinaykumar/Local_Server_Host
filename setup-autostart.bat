@echo off
setlocal
echo ========================================================
echo   Setting up Local Dev Hub to Auto-Start on Windows Boot
echo ========================================================
echo.

set SCRIPT_DIR=%~dp0
set VBS_PATH=%SCRIPT_DIR%start-hidden.vbs
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_PATH=%STARTUP_DIR%\DevHub.lnk

echo [1/2] Adding to Windows Registry (Run key)...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "DevHub" /t REG_SZ /d "C:\WINDOWS\system32\wscript.exe \"%VBS_PATH%\"" /f >nul
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Registered in Windows Registry Run key.
) else (
    echo [WARNING] Could not write to Registry Run key.
)

echo.
echo [2/2] Adding shortcut to Windows Startup folder...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'C:\WINDOWS\system32\wscript.exe'; $s.Arguments = '\"%VBS_PATH%\"'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Description = 'Local Dev Hub Auto Launcher'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo [SUCCESS] Shortcut placed in Windows Startup folder.
) else (
    echo [INFO] Startup folder shortcut skipped.
)

echo.
echo ========================================================
echo   Auto-start successfully configured.
echo   Local Dev Hub will start silently on every Windows boot.
echo ========================================================
echo.
echo Starting Local Dev Hub now...
start "" C:\WINDOWS\system32\wscript.exe "%VBS_PATH%"

echo.
echo Opening Dev Hub dashboard in browser: http://localhost:5555
ping -n 3 127.0.0.1 >nul
start "" "http://localhost:5555"

echo.
pause
