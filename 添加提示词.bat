@echo off
chcp 65001 >nul
title Prompt Uploader
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [ERROR] node.exe not found in PATH
  echo   Please install Node.js: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0prompt-uploader.ps1"

if errorlevel 1 (
  echo.
  echo   The window exited unexpectedly. Press any key to close.
  pause >nul
)