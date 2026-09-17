@echo off
cd /d "%~dp0"
node scripts/local-start.mjs
if errorlevel 1 pause
