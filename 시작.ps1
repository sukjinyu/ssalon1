$ErrorActionPreference = 'Stop'
$projectDirectory = $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) { $nodeExecutable = $nodeCommand.Source } else {
  $nodeExecutable = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
}
if (-not (Test-Path -LiteralPath $nodeExecutable)) { throw 'Node.js 24 이상을 설치해주세요.' }
try { $health = Invoke-RestMethod 'http://localhost:3000/api/health' -TimeoutSec 2 } catch { $health = $null }
if (-not $health.ok) {
  New-Item -ItemType Directory -Force -Path (Join-Path $projectDirectory 'data') | Out-Null
  Start-Process -FilePath $nodeExecutable -ArgumentList 'server/index.ts','--production' -WorkingDirectory $projectDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectDirectory 'data/server.log') -RedirectStandardError (Join-Path $projectDirectory 'data/server-error.log')
  for ($attempt=0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 250
    try { $health = Invoke-RestMethod 'http://localhost:3000/api/health' -TimeoutSec 1; if ($health.ok) { break } } catch {}
  }
  if (-not $health.ok) { throw '서버 시작에 실패했습니다. data/server-error.log를 확인해주세요.' }
}
Start-Process 'http://localhost:3000'
