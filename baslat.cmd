@echo off
rem Gurme Kart demosunu yerel bilgisayarda başlatır (Windows).
rem Node.js PATH'te yoksa kullanıcı klasöründeki taşınabilir sürüm denenir.
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.beef-tools\node-v24.21.0-win-x64\node.exe" (
    set "PATH=%USERPROFILE%\.beef-tools\node-v24.21.0-win-x64;%PATH%"
  ) else (
    echo Node.js bulunamadi. https://nodejs.org adresinden LTS surumunu kurun.
    pause
    exit /b 1
  )
)
cd /d "%~dp0"
if not exist node_modules call npm install
echo.
echo Demo: http://127.0.0.1:5175/
echo Kapatmak icin bu pencerede Ctrl+C.
echo.
call npm run dev
