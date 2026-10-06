@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>&1
if errorlevel 1 goto missing_npm

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing WM.SPO dependencies...
  call npm.cmd install
  if errorlevel 1 goto startup_failed
)

start "WM.SPO server" /D "%~dp0" cmd /k npm.cmd run dev
echo Waiting for WM.SPO to start...
for /l %%i in (1,1,60) do (
  curl.exe --silent --fail http://localhost:5173/ >nul 2>&1
  if not errorlevel 1 (
    start "" "http://localhost:5173"
    exit /b 0
  )
  timeout /t 1 /nobreak >nul
)

echo WM.SPO did not start within 60 seconds. Check the server window and app-debug.txt.
pause
exit /b 1

:missing_node
echo Node.js is not installed or is not on PATH. Install Node.js LTS, then try again.
pause
exit /b 1

:missing_npm
echo npm.cmd was not found. Reinstall Node.js LTS and ensure it is on PATH.
pause
exit /b 1

:startup_failed
echo Dependency installation failed. Check the messages above and app-debug.txt.
pause
exit /b 1
