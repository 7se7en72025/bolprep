param([ValidateRange(1, 65535)][int]$Port = 8000)

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
$progressDatabasePath = Join-Path $stateDirectory "$runId.sqlite3"
$process = $null
$baseUrl = "http://127.0.0.1:$Port"
$hadOpenAiKey = Test-Path Env:OPENAI_API_KEY
$previousOpenAiKey = $env:OPENAI_API_KEY
$hadAccessPassword = Test-Path Env:BOLPREP_ACCESS_PASSWORD
$previousAccessPassword = $env:BOLPREP_ACCESS_PASSWORD
$hadProgressDatabasePath = Test-Path Env:BOLPREP_DATABASE_PATH
$previousProgressDatabasePath = $env:BOLPREP_DATABASE_PATH

function Test-CheckServerListener {
    if (-not $process -or $process.HasExited) {
        throw 'The temporary check server is not running. No HTTP request was sent.'
    }
    # Inspect ownership before requesting health: another offline server can
    # otherwise satisfy readiness and receive this check's quiz writes.
    $listeners = @(Get-NetTCPConnection -ErrorAction Stop | Where-Object {
        $_.State -eq 'Listen' -and $_.LocalPort -eq $Port -and $_.LocalAddress -in @('127.0.0.1', '0.0.0.0', '::', '::1')
    })
    # Windows venv python.exe may redirect to a direct interpreter child.
    $ownedProcessIds = @($process.Id) + @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $($process.Id)" -ErrorAction Stop |
        Where-Object { $_.Name -eq 'python.exe' } | ForEach-Object { $_.ProcessId })
    if (@($listeners | Where-Object { $_.OwningProcess -notin $ownedProcessIds }).Count -gt 0) {
        throw "Port $Port belongs to another process. Choose another -Port or stop that server yourself. No HTTP request was sent."
    }
    return @($listeners | Where-Object {
        $_.OwningProcess -in $ownedProcessIds -and $_.LocalAddress -eq '127.0.0.1'
    }).Count -eq 1
}

function Assert-CheckServerListener {
    if (-not (Test-CheckServerListener)) {
        throw 'The temporary check server no longer owns its listener. No HTTP request was sent.'
    }
}

try {
    $env:OPENAI_API_KEY = ''
    $env:BOLPREP_ACCESS_PASSWORD = ''
    $env:BOLPREP_DATABASE_PATH = $progressDatabasePath
    $process = Start-Process -FilePath $pythonPath -ArgumentList @(
        '-u', ('"{0}"' -f (Join-Path $repoRoot 'server.py')), '--offline', '--port', $Port
    ) `
        -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

    $health = $null
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds(20)
    while ([DateTimeOffset]::UtcNow -lt $deadline) {
        if ($process.HasExited) {
            throw "The local server exited during startup. See $stderrPath."
        }
        if (-not (Test-CheckServerListener)) {
            Start-Sleep -Milliseconds 250
            continue
        }
        try {
            $health = Invoke-RestMethod -Uri "$baseUrl/health" -TimeoutSec 2
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

    Assert-CheckServerListener
    $page = Invoke-WebRequest -Uri "$baseUrl/" -UseBasicParsing -TimeoutSec 5
    if ($page.StatusCode -ne 200 -or $page.Content -notmatch 'BolPrep') {
        throw 'The tutor page did not load correctly.'
    }

    $body = @{
        question = 'Article 14 kya kehta hai?'
        language = 'hi-IN'
        history = @()
    } | ConvertTo-Json -Depth 4
    Assert-CheckServerListener
    $answer = Invoke-RestMethod -Uri "$baseUrl/api/answer" `
        -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 10
    if ($answer.answer -notmatch 'Article 14' -or -not $answer.sources -or $answer.sources.Count -lt 1) {
        throw 'The offline tutor did not return an Article 14 answer with a source.'
    }

    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    Assert-CheckServerListener
    $quizPage = Invoke-WebRequest -Uri "$baseUrl/" -UseBasicParsing -WebSession $session -TimeoutSec 5
    if ($quizPage.StatusCode -ne 200) { throw 'The quiz browser session could not be created.' }
    $quizBody = @{
        topic = 'fundamental rights'
        question_count = 1
        language = 'hi-IN'
    } | ConvertTo-Json -Depth 4
    Assert-CheckServerListener
    $quiz = Invoke-RestMethod -Uri "$baseUrl/api/quiz/start" `
        -Method Post -ContentType 'application/json' -Body $quizBody -WebSession $session -TimeoutSec 10
    if (-not $quiz.quiz_id -or $quiz.questions.Count -ne 1) { throw 'The offline quiz did not return one question.' }

    $scoreBody = @{
        quiz_id = $quiz.quiz_id
        question_id = $quiz.questions[0].id
        answer = 'I am practicing this answer.'
        idempotency_key = $runId
        language = 'hi-IN'
    } | ConvertTo-Json -Depth 4
    Assert-CheckServerListener
    $score = Invoke-RestMethod -Uri "$baseUrl/api/quiz/score" `
        -Method Post -ContentType 'application/json' -Body $scoreBody -WebSession $session -TimeoutSec 10
    Assert-CheckServerListener
    $retry = Invoke-RestMethod -Uri "$baseUrl/api/quiz/score" `
        -Method Post -ContentType 'application/json' -Body $scoreBody -WebSession $session -TimeoutSec 10
    Assert-CheckServerListener
    $progress = Invoke-RestMethod -Uri "$baseUrl/api/progress" `
        -WebSession $session -TimeoutSec 5
    if (($score.question_id -ne $quiz.questions[0].id) -or
        ($retry.score -ne $score.score) -or
        ($progress.attempt_count -ne 1) -or
        ($progress.questions.Count -ne 1)) {
        throw 'Quiz scoring retry or saved progress did not return the expected single result.'
    }

    $turnBody = @{ question = 'weak topics'; language = 'hi-IN'; history = @() } | ConvertTo-Json -Depth 4
    Assert-CheckServerListener
    $turnResponse = Invoke-WebRequest -Uri "$baseUrl/api/agent/turn" `
        -Method Post -ContentType 'application/json' -Body $turnBody -WebSession $session -UseBasicParsing -TimeoutSec 10
    $turnText = if ($turnResponse.Content -is [byte[]]) {
        [Text.Encoding]::UTF8.GetString($turnResponse.Content)
    } else { [string]$turnResponse.Content }
    $turnEvents = $turnText -split "`n" | Where-Object { $_.Trim() } | ForEach-Object { $_ | ConvertFrom-Json }
    $completed = @($turnEvents | Where-Object { $_.type -eq 'complete' })
    if ($completed.Count -ne 1) { throw "The offline agent did not complete its revision turn (events: $($turnEvents.type -join ','))." }
    $trace = $completed[0].payload.trace
    if (($trace.request_id -ne $turnResponse.Headers['X-Request-ID']) -or
        (-not $trace.request_id) -or ($trace.outcome -ne 'completed') -or
        ($trace.mode -ne 'offline') -or ($trace.server_duration_ms -lt 0) -or
        ($trace.tool_outcomes.Count -ne 1) -or ($trace.tool_outcomes[0].name -ne 'get_weak_topics') -or
        ($trace.tool_outcomes[0].ok -ne $true)) {
        throw 'The agent turn trace did not match its request ID and actual tool outcome.'
    }

    Write-Output "Local smoke check passed: offline mode, $($health.study_notes) study notes, page load, source-linked Hinglish answer, quiz progress/retry, and traced revision tool outcome."
}
finally {
    if ($process -and -not $process.HasExited) {
        Get-CimInstance Win32_Process -Filter "ParentProcessId = $($process.Id)" -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -eq 'python.exe' } | ForEach-Object {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            }
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        [void]$process.WaitForExit(5000)
    }
    if ($hadOpenAiKey) {
        $env:OPENAI_API_KEY = $previousOpenAiKey
    }
    else {
        Remove-Item Env:\OPENAI_API_KEY -ErrorAction SilentlyContinue
    }
    if ($hadAccessPassword) {
        $env:BOLPREP_ACCESS_PASSWORD = $previousAccessPassword
    }
    else {
        Remove-Item Env:\BOLPREP_ACCESS_PASSWORD -ErrorAction SilentlyContinue
    }
    if ($hadProgressDatabasePath) {
        $env:BOLPREP_DATABASE_PATH = $previousProgressDatabasePath
    }
    else {
        Remove-Item Env:\BOLPREP_DATABASE_PATH -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $progressDatabasePath, "$progressDatabasePath-wal", "$progressDatabasePath-shm" `
        -Force -ErrorAction SilentlyContinue
    if ((Test-Path -LiteralPath $stateDirectory) -and -not (Get-ChildItem -LiteralPath $stateDirectory -Force)) {
        Remove-Item -LiteralPath $stateDirectory -Force
    }
}
