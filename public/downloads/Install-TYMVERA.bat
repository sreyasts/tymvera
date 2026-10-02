@echo off
setlocal
title TYMVERA Windows Setup
echo ======================================================
echo           Installing TYMVERA Focus Routine OS         
echo ======================================================
echo.

set "INSTALL_DIR=%LOCALAPPDATA%\Programs\TYMVERA"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo [1/3] Copying application files...
copy /y "%~dp0TYMVERA-Windows.exe" "%INSTALL_DIR%\TYMVERA.exe" >nul 2>&1
if not exist "%INSTALL_DIR%\TYMVERA.exe" (
    copy /y "%~dp0public\downloads\TYMVERA-Windows.exe" "%INSTALL_DIR%\TYMVERA.exe" >nul 2>&1
)

echo [2/3] Unblocking security flags for Windows Defender...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -Path '%INSTALL_DIR%\TYMVERA.exe' -ErrorAction SilentlyContinue"

echo [3/3] Creating Desktop and Start Menu shortcuts...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'TYMVERA.lnk')); $s.TargetPath = '%INSTALL_DIR%\TYMVERA.exe'; $s.Description = 'TYMVERA Productivity OS'; $s.Save(); $sm = [IO.Path]::Combine([Environment]::GetFolderPath('StartMenu'), 'Programs', 'TYMVERA.lnk'); $s2 = $ws.CreateShortcut($sm); $s2.TargetPath = '%INSTALL_DIR%\TYMVERA.exe'; $s2.Description = 'TYMVERA Productivity OS'; $s2.Save()"

echo.
echo ======================================================
echo     Installation Complete! Launching TYMVERA...       
echo ======================================================
start "" "%INSTALL_DIR%\TYMVERA.exe"
timeout /t 2 >nul
exit /b 0
