@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.jsが見つかりません。READMEを確認し担当へ返してください。自動導入しません。
 pause
 exit /b 1
)
node "%~dp0control.mjs" start
set V12_RESULT=%ERRORLEVEL%
pause
exit /b %V12_RESULT%
