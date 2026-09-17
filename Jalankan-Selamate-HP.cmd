@echo off
cd /d "%~dp0"
node scripts/local-start.mjs --hp
if errorlevel 1 pause
