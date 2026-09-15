@echo off
chcp 65001 > nul
cd /d "%~dp0"

cls
echo ============================================================
echo 로열 살롱 Cloudflare 배포 도우미 - CMD 전용
echo ============================================================
echo.
echo 이 파일은 PowerShell을 사용하지 않습니다.
echo Windows 보안 오류가 PowerShell 때문에 생기는 경우 이 파일을 쓰세요.
echo.
echo 중간에 직접 할 일은 두 가지입니다.
echo 1. Cloudflare 로그인 창에서 Allow/허용 누르기
echo 2. database_id 복사해서 붙여넣기
echo.
pause

if not exist package.json (
  echo.
  echo [오류] package.json을 찾지 못했습니다.
  echo royal-salon 폴더 안에서 이 파일을 실행해야 합니다.
  pause
  exit /b 1
)

if not exist wrangler.toml (
  echo.
  echo [오류] wrangler.toml을 찾지 못했습니다.
  echo 배포 설정 파일이 없습니다.
  pause
  exit /b 1
)

echo.
echo [1/5] Cloudflare 로그인
echo 브라우저가 열리면 Cloudflare에 로그인하고 Allow/허용을 누르세요.
echo 이미 로그인되어 있으면 바로 다음 단계로 넘어갑니다.
echo.
pause
call npx wrangler login
if errorlevel 1 goto fail

echo.
echo [2/5] D1 데이터베이스 만들기
echo 저장/순위 기능에 필요한 무료 데이터베이스를 만듭니다.
echo 명령이 끝나면 database_id = "..." 줄이 나옵니다.
echo.
pause
call npx wrangler d1 create royal-salon-db
if errorlevel 1 goto fail

echo.
echo [3/5] database_id 붙여넣기
echo 위에 나온 database_id의 따옴표 안쪽 값만 복사해서 붙여넣으세요.
echo 예: 12345678-abcd-1234-abcd-1234567890ab
echo.
set /p DB_ID=database_id 붙여넣기: 
if "%DB_ID%"=="" goto no_db

node -e "const fs=require('fs'); const id=process.env.DB_ID.trim().replace(/^\"|\"$/g,''); if(!id) process.exit(2); let text=fs.readFileSync('wrangler.toml','utf8'); text=text.replace(/database_id = \".*\"/, 'database_id = \"'+id+'\"'); fs.writeFileSync('wrangler.toml', text); console.log('wrangler.toml 저장 완료');"
if errorlevel 1 goto fail

echo.
echo [4/5] D1 테이블 만들기
echo 별명 저장, 리셋, 순위 기능에 필요한 표를 만듭니다.
echo.
call npx wrangler d1 execute royal-salon-db --remote --file migrations/0001_player_saves.sql
if errorlevel 1 goto fail

echo.
echo [5/5] 빌드하고 Cloudflare Pages에 배포하기
echo 끝나면 https://...pages.dev 주소가 나옵니다.
echo.
call npm run build
if errorlevel 1 goto fail
call npx wrangler pages deploy dist --project-name royal-salon
if errorlevel 1 goto fail

echo.
echo ============================================================
echo 배포가 끝났습니다!
echo 위에 나온 https://...pages.dev 주소가 내 게임 주소입니다.
echo ============================================================
pause
exit /b 0

:no_db
echo.
echo database_id가 비어 있습니다. 다시 실행해서 실제 ID를 붙여넣어 주세요.
pause
exit /b 1

:fail
echo.
echo ============================================================
echo 중간에 오류가 났습니다.
echo 화면에 나온 오류 문장을 복사해서 저에게 보내주세요.
echo 예: [2/5]에서 이런 오류가 나왔어: ...
echo ============================================================
pause
exit /b 1
