param(
    [ValidateRange(1, 24)]
    [int]$DurationHours = 8,
    [ValidateRange(1, 100)]
    [int]$MaxRuns = 24
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$instructionsPath = Join-Path $repoRoot 'AUTONOMOUS_WORK.md'
$statePath = Join-Path $repoRoot '.codex\overnight'
$pidPath = Join-Path $statePath 'loop.pid'
$stopPath = Join-Path $statePath 'stop.request'
$statusPath = Join-Path $statePath 'status.txt'
$codexCommand = Get-Command codex -ErrorAction Stop
$codexPath = $codexCommand.Source

New-Item -ItemType Directory -Path $statePath -Force | Out-Null
if (Test-Path $pidPath) {
    $oldPid = 0
    [void][int]::TryParse((Get-Content -Raw $pidPath), [ref]$oldPid)
    if ($oldPid -gt 0 -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
        throw "BolPrep work loop is already running (PID $oldPid)."
    }
    Remove-Item -LiteralPath $pidPath -Force
}
Remove-Item -LiteralPath $stopPath -Force -ErrorAction SilentlyContinue
Set-Content -LiteralPath $pidPath -Value $PID -Encoding ascii

$deadline = [DateTimeOffset]::UtcNow.AddHours($DurationHours)
$runNumber = 0
$retryDelaySeconds = 20
$taskIntervalSeconds = [Math]::Max(300, [int](($DurationHours * 3600) / $MaxRuns))
$stoppedForDecision = $false

function Write-Status([string]$Message) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
    Add-Content -LiteralPath $statusPath -Value $line -Encoding utf8
}

Write-Status "Started PID $PID; deadline $($deadline.ToString('u')); max runs $MaxRuns."
try {
    while (
        [DateTimeOffset]::UtcNow -lt $deadline -and
        $runNumber -lt $MaxRuns -and
        -not (Test-Path $stopPath)
    ) {
        $runNumber += 1
        $runTag = '{0:D2}-{1}' -f $runNumber, (Get-Date -Format 'yyyyMMdd-HHmmss')
        $stdoutPath = Join-Path $statePath "$runTag.jsonl"
        $stderrPath = Join-Path $statePath "$runTag.stderr.log"
        $lastMessagePath = Join-Path $statePath "$runTag.final.txt"
        $prompt = Get-Content -Raw -LiteralPath $instructionsPath
        $arguments = @(
            'exec', '--json', '--approve-for-me',
            '-C', $repoRoot, '-o', $lastMessagePath, $prompt
        )

        Write-Status "Run $runNumber started."
        $exitCode = 1
        try {
            & $codexPath @arguments 1> $stdoutPath 2> $stderrPath
            $exitCode = $LASTEXITCODE
        }
        catch {
            Add-Content -LiteralPath $stderrPath -Value $_.ToString() -Encoding utf8
        }

        if ($exitCode -eq 0 -and (Test-Path $lastMessagePath)) {
            $finalMessage = Get-Content -Raw -LiteralPath $lastMessagePath
            $firstLine = ($finalMessage -split "`r?`n", 2)[0]
            Write-Status "Run $runNumber completed with marker: $firstLine"
            if ($firstLine -match '^\[STOP\]') {
                Write-Status "Stopped because a user decision is needed."
                $stoppedForDecision = $true
                break
            }
            if ($firstLine -notmatch '^\[CONTINUE\]') {
                Write-Status "Run $runNumber omitted a recognized marker; retrying after backoff."
                $retryDelaySeconds = [Math]::Min(300, $retryDelaySeconds * 2)
            }
            else {
                $retryDelaySeconds = 20
            }
        }
        else {
            Write-Status "Run $runNumber failed with exit code $exitCode; retrying after backoff."
            $retryDelaySeconds = [Math]::Min(300, $retryDelaySeconds * 2)
        }

        $remainingSeconds = [int]($deadline - [DateTimeOffset]::UtcNow).TotalSeconds
        if ($remainingSeconds -gt 0 -and -not (Test-Path $stopPath)) {
            $waitSeconds = if ($exitCode -eq 0) { $taskIntervalSeconds } else { $retryDelaySeconds }
            Write-Status "Waiting $waitSeconds second(s) before the next task."
            $waitRemaining = [Math]::Min($waitSeconds, $remainingSeconds)
            while ($waitRemaining -gt 0 -and -not (Test-Path $stopPath)) {
                $sleepSlice = [Math]::Min(30, $waitRemaining)
                Start-Sleep -Seconds $sleepSlice
                $waitRemaining -= $sleepSlice
            }
        }
    }

    if ($stoppedForDecision) {
        Write-Status 'The loop exited while waiting for a user decision.'
    }
    elseif (Test-Path $stopPath) {
        Write-Status 'Stop requested; the loop has exited.'
    }
    elseif ($runNumber -ge $MaxRuns) {
        Write-Status 'Maximum run count reached; the loop has exited.'
    }
    else {
        Write-Status 'Time limit reached; the loop has exited.'
    }
}
finally {
    Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
}
