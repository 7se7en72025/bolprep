param(
    [ValidateRange(1, 24)]
    [int]$DurationHours = 8,
    [ValidateRange(1, 100)]
    [int]$MaxRuns = 24
)

$runner = Join-Path $PSScriptRoot 'continue-work.ps1'
$powerShellPath = Join-Path $PSHOME 'powershell.exe'
$arguments = @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runner,
    '-DurationHours', $DurationHours, '-MaxRuns', $MaxRuns
)
$process = Start-Process -FilePath $powerShellPath -ArgumentList $arguments -WindowStyle Hidden -PassThru
Write-Output "BolPrep work loop started (PID $($process.Id)). It will stop after $DurationHours hour(s) or $MaxRuns runs."
Write-Output 'Run tools\stop-work-loop.ps1 to request a graceful stop.'
Write-Output 'Logs: .codex\overnight\status.txt'
