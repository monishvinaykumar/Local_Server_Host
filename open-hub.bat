@echo off
powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort 5555 -ErrorAction SilentlyContinue)) { Start-Process 'explorer.exe' '\"%~dp0start-hidden.vbs\"'; Start-Sleep -Seconds 1 }"
start "" "http://localhost:5555"
