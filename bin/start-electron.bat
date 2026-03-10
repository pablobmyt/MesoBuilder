@echo off
REM Start Electron with increased V8 heap size (Windows launcher)
SETLOCAL
REM Default heap size (MB) - change if needed
set HEAP=4096

REM Try to run local electron if available
if exist "%~dp0\..\node_modules\electron\dist\electron.exe" (
  "%~dp0\..\node_modules\electron\dist\electron.exe" --js-flags="--max-old-space-size=%HEAP%" "%~dp0\..\"
  goto :EOF
)

REM Fallback to npx (requires npm installed)
npx electron --js-flags="--max-old-space-size=%HEAP%" .
ENDLOCAL
