param([ValidateRange(0, 65535)][int]$Port = 0)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$venvPython = Join-Path $repoRoot '.venv\Scripts\python.exe'
$pythonPath = if (Test-Path -LiteralPath $venvPython) {
    $venvPython
} else {
    (Get-Command python.exe -ErrorAction Stop).Source
}

$browserCandidates = @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
)
$browserPath = if ($env:BOLPREP_BROWSER_PATH) {
    $env:BOLPREP_BROWSER_PATH
} else {
    $browserCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $browserPath -or -not (Test-Path -LiteralPath $browserPath -PathType Leaf)) {
    throw 'Chrome or Edge was not found. Set BOLPREP_BROWSER_PATH to an installed browser executable.'
}
if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) -or
    -not (Get-Command Get-CimInstance -ErrorAction SilentlyContinue)) {
    throw 'This Windows check needs Get-NetTCPConnection and Get-CimInstance.'
}

if ($Port -eq 0) {
    $portProbe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    try {
        $portProbe.Start()
        $Port = [int]$portProbe.LocalEndpoint.Port
    }
    finally {
        $portProbe.Stop()
    }
}
$baseUrl = "http://127.0.0.1:$Port/"
$stateDirectory = Join-Path $repoRoot '.codex\browser-check'
New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
$runId = [guid]::NewGuid().ToString('N')
$stdoutPath = Join-Path $stateDirectory "$runId.stdout.log"
$stderrPath = Join-Path $stateDirectory "$runId.stderr.log"
$databasePath = Join-Path $stateDirectory "$runId.sqlite3"
$serverProcess = $null
$environmentNames = @(
    'OPENAI_API_KEY', 'BOLPREP_ACCESS_PASSWORD', 'BOLPREP_DATABASE_PATH',
    'BOLPREP_TEST_BASE_URL', 'BOLPREP_BROWSER_PATH', 'BOLPREP_OFFLINE'
)
$previousEnvironment = @{}
foreach ($name in $environmentNames) {
    $item = Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue
    $previousEnvironment[$name] = if ($item) { $item.Value } else { $null }
}

function Test-OwnedListener {
    if (-not $serverProcess -or $serverProcess.HasExited) {
        throw 'The temporary browser-check server is not running. No HTTP request was sent.'
    }
    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    $childIds = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $($serverProcess.Id)" -ErrorAction Stop |
        Where-Object { $_.Name -eq 'python.exe' } | ForEach-Object { $_.ProcessId })
    $ownedIds = @($serverProcess.Id) + $childIds
    if (@($listeners | Where-Object { $_.OwningProcess -notin $ownedIds }).Count -gt 0) {
        throw "Port $Port has a foreign listener. No HTTP request was sent."
    }
    return @($listeners | Where-Object {
        $_.OwningProcess -in $ownedIds -and $_.LocalAddress -eq '127.0.0.1'
    }).Count -eq 1
}

try {
    $env:OPENAI_API_KEY = ''
    $env:BOLPREP_ACCESS_PASSWORD = ''
    $env:BOLPREP_OFFLINE = '1'
    $env:BOLPREP_DATABASE_PATH = $databasePath
    $env:BOLPREP_TEST_BASE_URL = $baseUrl
    $env:BOLPREP_BROWSER_PATH = $browserPath

    $serverProcess = Start-Process -FilePath $pythonPath -ArgumentList @(
        '-u', ('"{0}"' -f (Join-Path $repoRoot 'server.py')), '--offline', '--port', "$Port"
    ) -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

    $healthy = $false
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds(30)
    while ([DateTimeOffset]::UtcNow -lt $deadline) {
        if (Test-OwnedListener) {
            try {
                $health = Invoke-RestMethod -Uri "${baseUrl}health" -TimeoutSec 2
                if ($health.ok -and $health.mode -eq 'offline' -and
                    $health.access_protected -eq $false -and $health.study_notes -gt 0) {
                    $healthy = $true
                    break
                }
                throw 'The temporary server returned unexpected health metadata.'
            }
            catch [System.Net.WebException] {
                # The owned listener may not be ready to answer immediately.
            }
        }
        Start-Sleep -Milliseconds 250
    }
    if (-not $healthy) { throw 'The temporary offline server did not become healthy within 30 seconds.' }
    if (-not (Test-OwnedListener)) { throw 'The temporary server lost its listener before browser tests.' }

    Push-Location -LiteralPath $repoRoot
    try {
        & npm.cmd run test:browser
        if ($LASTEXITCODE -ne 0) { throw "Headless browser tests failed with exit code $LASTEXITCODE." }
    }
    finally {
        Pop-Location
    }
    if (-not (Test-OwnedListener)) { throw 'The temporary server lost its listener during browser tests.' }
    Write-Output "Headless offline browser checks passed at $baseUrl with a disposable database."
}
finally {
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Get-CimInstance Win32_Process -Filter "ParentProcessId = $($serverProcess.Id)" -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -eq 'python.exe' } | ForEach-Object {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            }
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
        [void]$serverProcess.WaitForExit(5000)
    }
    foreach ($name in $environmentNames) {
        if ($null -eq $previousEnvironment[$name]) {
            Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
        } else {
            Set-Item -Path "Env:$name" -Value $previousEnvironment[$name]
        }
    }
    Remove-Item -LiteralPath $stdoutPath, $stderrPath, $databasePath,
        "$databasePath-wal", "$databasePath-shm" -Force -ErrorAction SilentlyContinue
    if ((Test-Path -LiteralPath $stateDirectory) -and
        -not (Get-ChildItem -LiteralPath $stateDirectory -Force)) {
        Remove-Item -LiteralPath $stateDirectory -Force
    }
}
