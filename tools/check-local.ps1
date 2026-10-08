param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pythonPath = Join-Path $repoRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw 'The project virtual environment is missing. Run tools\run-local.ps1 once to prepare it.'
}

$stateDirectory = Join-Path $repoRoot '.codex\local-check'
New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
$runId = [guid]::NewGuid().ToString('N')
$stdoutPath = Join-Path $stateDirectory "$runId.stdout.log"
$stderrPath = Join-Path $stateDirectory "$runId.stderr.log"
$process = $null
$hadOpenAiKey = Test-Path Env:OPENAI_API_KEY
$previousOpenAiKey = $env:OPENAI_API_KEY

try {
    $env:OPENAI_API_KEY = ''
    $process = Start-Process -FilePath $pythonPath -ArgumentList (Join-Path $repoRoot 'server.py') `
        -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

    $health = $null
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds(20)
    while ([DateTimeOffset]::UtcNow -lt $deadline) {
        if ($process.HasExited) {
            throw "The local server exited during startup. See $stderrPath."
        }
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 2
            break
        }
        catch {
            Start-Sleep -Milliseconds 250
        }
    }
    if (-not $health) { throw 'The local server did not become healthy within 20 seconds.' }
    if (-not $health.ok -or $health.mode -ne 'offline' -or $health.study_notes -lt 1) {
        throw "Unexpected health response: $($health | ConvertTo-Json -Compress)"
    }

    $page = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/' -UseBasicParsing -TimeoutSec 5
    if ($page.StatusCode -ne 200 -or $page.Content -notmatch 'BolPrep') {
        throw 'The tutor page did not load correctly.'
    }

    $body = @{
        question = 'Article 14 kya kehta hai?'
        language = 'hi-IN'
        history = @()
    } | ConvertTo-Json -Depth 4
    $answer = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/answer' `
        -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 10
    if ($answer.answer -notmatch 'Article 14' -or -not $answer.sources -or $answer.sources.Count -lt 1) {
        throw 'The offline tutor did not return an Article 14 answer with a source.'
    }

    Write-Output "Local smoke check passed: offline mode, $($health.study_notes) study notes, page load, and a source-linked Hinglish Article 14 answer."
}
finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        [void]$process.WaitForExit(5000)
    }
    if ($hadOpenAiKey) {
        $env:OPENAI_API_KEY = $previousOpenAiKey
    }
    else {
        Remove-Item Env:\OPENAI_API_KEY -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
    if ((Test-Path -LiteralPath $stateDirectory) -and -not (Get-ChildItem -LiteralPath $stateDirectory -Force)) {
        Remove-Item -LiteralPath $stateDirectory -Force
    }
}
