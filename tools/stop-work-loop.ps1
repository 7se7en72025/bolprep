$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$statePath = Join-Path $repoRoot '.codex\overnight'
$pidPath = Join-Path $statePath 'loop.pid'
$stopPath = Join-Path $statePath 'stop.request'

if (-not (Test-Path $pidPath)) {
    Write-Output 'No BolPrep work loop is running.'
    exit 0
}

New-Item -ItemType File -Path $stopPath -Force | Out-Null
Write-Output 'Stop requested. The loop will finish its current task and then exit.'
