@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.jsが見つかりません。担当へ返してください。
 pause
 exit /b 1
)
node "%~dp0control.mjs" check
set V12_RESULT=%ERRORLEVEL%
pause
exit /b %V12_RESULT%
