@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo 로열 살롱 Cloudflare 배포 도우미를 시작합니다.
echo.
echo Windows 보안 설정 때문에 PowerShell 스크립트가 막히는 경우,
echo 이 파일은 현재 실행 한 번에만 제한을 우회합니다.
echo 컴퓨터 전체 보안 설정은 바꾸지 않습니다.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0배포도우미.ps1"
echo.
echo 창을 닫으려면 아무 키나 누르세요.
pause > nul
