@echo off
rem Double-click this file to start the Rubik's Cube Solver.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get it from https://nodejs.org and run this again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run: installing the libraries. This needs the internet once and takes a minute...
  call npm install
  if errorlevel 1 (
    echo Installing failed. Check your internet connection and run this again.
    pause
    exit /b 1
  )
)

echo Starting the app. Your browser will open. Close this window to stop it.
call npm start
pause
