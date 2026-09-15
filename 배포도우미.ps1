# 로열 살롱 Cloudflare 무료 배포 도우미
# PowerShell에서 실행: .\배포도우미.ps1

$ErrorActionPreference = 'Stop'

function Say($text) {
  Write-Host ""
  Write-Host $text -ForegroundColor Cyan
}

function StepTitle($number, $title) {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor DarkGray
  Write-Host "[$number/6] $title" -ForegroundColor Yellow
  Write-Host "============================================================" -ForegroundColor DarkGray
}

function Pause-Step($message = '준비되면 Enter를 눌러주세요') {
  Write-Host ""
  Read-Host $message | Out-Null
}

function Run($command, $arguments) {
  Write-Host ""
  Write-Host "> $command $($arguments -join ' ')" -ForegroundColor DarkGray
  & $command @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "명령 실행에 실패했습니다: $command $($arguments -join ' ')"
  }
}

Clear-Host
Write-Host "로열 살롱 Cloudflare 무료 배포 도우미" -ForegroundColor Magenta
Write-Host "이 파일은 어려운 명령어를 대신 순서대로 실행합니다."
Write-Host "중간에 Cloudflare 로그인과 database_id 붙여넣기만 직접 해주시면 됩니다."

StepTitle 1 '프로젝트 폴더 확인'
Write-Host "현재 폴더: $PWD"
if (!(Test-Path 'package.json') -or !(Test-Path 'wrangler.toml')) {
  throw 'royal-salon 프로젝트 폴더에서 실행해야 합니다.'
}
Say '프로젝트 폴더가 맞습니다.'
Pause-Step

StepTitle 2 'Cloudflare 로그인'
Write-Host '브라우저가 열리면 Cloudflare에 로그인하고 Allow/허용을 눌러주세요.'
Write-Host '로그인이 이미 되어 있다면 바로 다음 단계로 넘어갑니다.'
Pause-Step '브라우저 로그인을 시작하려면 Enter를 눌러주세요'
Run 'npx' @('wrangler', 'login')

StepTitle 3 'D1 데이터베이스 만들기'
Write-Host '게임 저장과 순위를 담을 무료 D1 데이터베이스를 만듭니다.'
Write-Host '명령이 끝나면 화면에 database_id = "..." 줄이 보입니다.'
Pause-Step 'D1 생성을 시작하려면 Enter를 눌러주세요'
Run 'npx' @('wrangler', 'd1', 'create', 'royal-salon-db')

StepTitle 4 'database_id 붙여넣기'
Write-Host '위 결과에서 database_id 안쪽 값을 복사해 아래에 붙여넣어 주세요.'
Write-Host '예: 12345678-abcd-1234-abcd-1234567890ab'
$dbId = Read-Host 'database_id'
$dbId = $dbId.Trim().Trim('"')
if (!$dbId -or $dbId -eq '여기에-d1-database-id-붙여넣기') {
  throw 'database_id가 비어 있습니다. Cloudflare가 보여준 실제 ID를 붙여넣어야 합니다.'
}
$toml = Get-Content 'wrangler.toml' -Raw
$toml = $toml -replace 'database_id = ".*"', "database_id = `"$dbId`""
Set-Content 'wrangler.toml' $toml
Say 'wrangler.toml에 database_id를 저장했습니다.'

StepTitle 5 '저장 테이블 만들기'
Write-Host '별명별 저장, 리셋, 순위 기능에 필요한 테이블을 Cloudflare D1에 만듭니다.'
Run 'npx' @('wrangler', 'd1', 'execute', 'royal-salon-db', '--remote', '--file', 'migrations/0001_player_saves.sql')

StepTitle 6 '빌드하고 배포하기'
Write-Host '게임을 빌드한 뒤 Cloudflare Pages에 업로드합니다.'
Write-Host '끝나면 https://...pages.dev 주소가 표시됩니다. 그 주소가 배포된 게임 주소입니다.'
Run 'npm' @('run', 'build')
Run 'npx' @('wrangler', 'pages', 'deploy', 'dist', '--project-name', 'royal-salon')

Write-Host ""
Write-Host '배포가 끝났습니다!' -ForegroundColor Green
Write-Host '위에 표시된 https://...pages.dev 주소를 복사해서 열어보세요.'
Write-Host '확인할 것: 게임 화면, 별명 저장, 순위 탭, 상점 저장.'
