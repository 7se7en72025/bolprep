param(
    [ValidateRange(1, 24)]
    [int]$DurationHours = 8,
    [ValidateRange(1, 100)]
    [int]$MaxRuns = 24,
    [ValidateRange(1, 180)]
    [int]$TaskTimeoutMinutes = 60
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$instructionsPath = Join-Path $repoRoot 'AUTONOMOUS_WORK.md'
$invokePath = Join-Path $PSScriptRoot 'invoke-codex-run.ps1'
$powerShellPath = Join-Path $PSHOME 'powershell.exe'
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
        $configPath = Join-Path $statePath "$runTag.config.json"
        $runnerPidPath = Join-Path $statePath "$runTag.runner.pid"
        $prompt = Get-Content -Raw -LiteralPath $instructionsPath
        $arguments = @(
            'exec', '--json', '--approve-for-me',
            '-C', $repoRoot, '-o', $lastMessagePath, $prompt
        )

        Write-Status "Run $runNumber started."
        $exitCode = 1
        $retryNeeded = $true
        $timedOut = $false
        try {
            $config = @{
                codex_path = $codexPath
                arguments = $arguments
                stdout_path = $stdoutPath
                stderr_path = $stderrPath
            } | ConvertTo-Json -Depth 4
            Set-Content -LiteralPath $configPath -Value $config -Encoding utf8
            $helperArguments = "-NoProfile -ExecutionPolicy Bypass -File `"$invokePath`" -ConfigPath `"$configPath`""
            $taskProcess = Start-Process -FilePath $powerShellPath -ArgumentList $helperArguments -WindowStyle Hidden -PassThru
            Set-Content -LiteralPath $runnerPidPath -Value $taskProcess.Id -Encoding ascii
            Write-Status "Run $runNumber is executing in helper PID $($taskProcess.Id); timeout is $TaskTimeoutMinutes minute(s)."

            $remainingMilliseconds = [Math]::Max(1, [int]($deadline - [DateTimeOffset]::UtcNow).TotalMilliseconds)
            $taskWaitMilliseconds = [Math]::Min($TaskTimeoutMinutes * 60 * 1000, $remainingMilliseconds)
            if (-not $taskProcess.WaitForExit($taskWaitMilliseconds)) {
                $timedOut = $true
                if ([DateTimeOffset]::UtcNow -ge $deadline) {
                    Write-Status "Run $runNumber reached the loop deadline; terminating its helper process tree."
                }
                else {
                    Write-Status "Run $runNumber exceeded its task timeout; terminating helper process tree."
                }
                $taskkillPath = Join-Path $env:SystemRoot 'System32\taskkill.exe'
                & $taskkillPath /PID $taskProcess.Id /T /F *> $null
                [void]$taskProcess.WaitForExit(5000)
                if (Get-Process -Id $taskProcess.Id -ErrorAction SilentlyContinue) {
                    Stop-Process -Id $taskProcess.Id -Force -ErrorAction SilentlyContinue
                }
                $exitCode = 124
            }
            else {
                $taskProcess.Refresh()
                $exitCode = $taskProcess.ExitCode
            }
        }
        catch {
            Add-Content -LiteralPath $stderrPath -Value $_.ToString() -Encoding utf8
        }
        finally {
            Remove-Item -LiteralPath $configPath, $runnerPidPath -Force -ErrorAction SilentlyContinue
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
                $retryNeeded = $false
            }
        }
        else {
            if ($timedOut) {
                Write-Status "Run $runNumber timed out; retrying after backoff."
            }
            else {
                Write-Status "Run $runNumber failed with exit code $exitCode; retrying after backoff."
            }
            $retryDelaySeconds = [Math]::Min(300, $retryDelaySeconds * 2)
        }

        $remainingSeconds = [int]($deadline - [DateTimeOffset]::UtcNow).TotalSeconds
        if ($remainingSeconds -gt 0 -and -not (Test-Path $stopPath)) {
            $waitSeconds = if ($retryNeeded) { $retryDelaySeconds } else { $taskIntervalSeconds }
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
