@echo off
chcp 65001 >nul
title 提示词上传器
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [错误] 找不到 node.exe
  echo.
  echo   请确认 Node.js 已安装并加入 PATH。
  echo   下载: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0上传提示词.ps1"

if errorlevel 1 (
  echo.
  echo   界面异常退出。按任意键关闭窗口。
  pause >nul
)
