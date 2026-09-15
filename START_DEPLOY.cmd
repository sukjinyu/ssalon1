@echo off
cd /d "%~dp0"
start "Royal Salon Deploy Helper" cmd /k call "%~dp0deploy_cmd_core.cmd"
