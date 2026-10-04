param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $repoRoot

$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCommand) {
    throw 'Python 3.11 or later was not found. Install Python and enable the PATH option, then run this command again.'
}
$pythonVersionText = & $pythonCommand.Source -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
if ($LASTEXITCODE -ne 0 -or [version]$pythonVersionText -lt [version]'3.11') {
    throw "Python 3.11 or later is required; found Python $pythonVersionText."
}

$venvPython = Join-Path $repoRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $venvPython)) {
    Write-Output 'Creating the project virtual environment...'
    & $pythonCommand.Source -m venv (Join-Path $repoRoot '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the virtual environment.' }
}

Write-Output 'Installing project dependencies...'
& $venvPython -m pip install -r (Join-Path $repoRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }

$envPath = Join-Path $repoRoot '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
    Copy-Item -LiteralPath (Join-Path $repoRoot '.env.example') -Destination $envPath
    Write-Output 'Created .env from the example. Add an API key there for model answers; offline mode works without one.'
}

Write-Output 'Starting BolPrep at http://127.0.0.1:8000 (press Ctrl+C to stop).'
& $venvPython (Join-Path $repoRoot 'server.py')
