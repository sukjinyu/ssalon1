@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo ============================================================
echo Royal Salon Cloudflare Deploy Helper
echo ============================================================
echo.
echo This window should stay open even if an error happens.
echo You only need to follow the messages on this screen.
echo.
echo If Korean text is broken, that is okay. The deploy still works.
echo.
pause

if not exist package.json (
  echo.
  echo ERROR: package.json was not found.
  echo Please run this file inside the royal-salon folder.
  pause
  exit /b 1
)

if not exist wrangler.toml (
  echo.
  echo ERROR: wrangler.toml was not found.
  pause
  exit /b 1
)

where node > nul 2> nul
if errorlevel 1 goto no_node

where npm > nul 2> nul
if errorlevel 1 goto no_node

where npx > nul 2> nul
if errorlevel 1 goto no_node

echo.
echo [1/5] Cloudflare login
echo A browser will open. Login to Cloudflare and click Allow.
echo.
pause
call npx wrangler login
if errorlevel 1 goto fail

echo.
echo [2/5] Create free D1 database
echo After this command, find the line: database_id = "..."
echo.
pause
call npx wrangler d1 create royal-salon-db
if errorlevel 1 goto fail

echo.
echo [3/5] Paste database_id
echo Copy only the value inside quotes.
echo Example: 12345678-abcd-1234-abcd-1234567890ab
echo.
set /p DB_ID=Paste database_id here: 
if "%DB_ID%"=="" goto no_db

node -e "const fs=require('fs'); const id=process.env.DB_ID.trim().replace(/^\"|\"$/g,''); if(!id) process.exit(2); let text=fs.readFileSync('wrangler.toml','utf8'); text=text.replace(/database_id = \".*\"/, 'database_id = \"'+id+'\"'); fs.writeFileSync('wrangler.toml', text); console.log('Saved database_id to wrangler.toml');"
if errorlevel 1 goto fail

echo.
echo [4/5] Create database table
echo.
call npx wrangler d1 execute royal-salon-db --remote --file migrations/0001_player_saves.sql
if errorlevel 1 goto fail

echo.
echo [5/5] Build and deploy to Cloudflare Pages
echo At the end, copy the https://...pages.dev URL.
echo.
call npm run build
if errorlevel 1 goto fail
call npx wrangler pages deploy dist --project-name royal-salon
if errorlevel 1 goto fail

echo.
echo ============================================================
echo DONE!
echo Copy the https://...pages.dev URL above.
echo ============================================================
pause
exit /b 0

:no_db
echo.
echo database_id was empty. Please run again and paste the real ID.
pause
exit /b 1

:no_node
echo.
echo ============================================================
echo Node.js was not found on this computer.
echo.
echo Please install the free LTS version from:
echo https://nodejs.org
echo.
echo After installing, close this window and double-click START_DEPLOY.cmd again.
echo ============================================================
pause
exit /b 1

:fail
echo.
echo ============================================================
echo An error happened.
echo Please copy the error text above and send it to Codex.
echo This window will stay open.
echo ============================================================
pause
exit /b 1
