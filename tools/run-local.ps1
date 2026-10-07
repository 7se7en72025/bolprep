param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $repoRoot

$venvDirectory = Join-Path $repoRoot '.venv'
$venvPython = Join-Path $venvDirectory 'Scripts\python.exe'
$pythonCandidates = @()
if (Test-Path -LiteralPath $venvPython) {
    $pythonCandidates += [pscustomobject]@{ Path = $venvPython; Arguments = @() }
}
$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCommand) {
    $pythonCandidates += [pscustomobject]@{ Path = $pythonCommand.Source; Arguments = @() }
}
$pyCommand = Get-Command py -ErrorAction SilentlyContinue
if ($pyCommand) {
    $pythonCandidates += [pscustomobject]@{ Path = $pyCommand.Source; Arguments = @('-3') }
}
if (-not $pythonCandidates.Count) {
    throw 'Python 3.11 or later was not found in .venv, PATH, or the Windows py launcher. Install Python, then run this command again.'
}
$pythonPath = $null
$pythonArguments = @()
$pythonVersionText = $null
foreach ($candidate in $pythonCandidates) {
    $candidateArguments = @($candidate.Arguments)
    $candidateVersionText = & $candidate.Path @candidateArguments -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
    if ($LASTEXITCODE -ne 0) { continue }
    $pythonVersionText = $candidateVersionText
    try {
        $candidateVersion = [version]$candidateVersionText
    }
    catch {
        continue
    }
    if ($candidateVersion -ge [version]'3.11') {
        $pythonPath = $candidate.Path
        $pythonArguments = $candidateArguments
        $pythonVersionText = $candidateVersionText
        break
    }
}
if (-not $pythonPath) {
    $foundVersion = if ($pythonVersionText) { "Found Python $pythonVersionText." } else { 'No usable Python version was reported.' }
    throw "Python 3.11 or later is required. Checked the existing .venv, python, and the py launcher. $foundVersion"
}

$venvUsable = $false
if (Test-Path -LiteralPath $venvPython) {
    $existingVenvVersionText = & $venvPython -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
    if ($LASTEXITCODE -eq 0) {
        try {
            $venvUsable = [version]$existingVenvVersionText -ge [version]'3.11'
        }
        catch {
            $venvUsable = $false
        }
    }
}

if (-not $venvUsable) {
    $resolvedVenvDirectory = [IO.Path]::GetFullPath($venvDirectory)
    if (Test-Path -LiteralPath $venvDirectory) {
        $venvAttributes = (Get-Item -LiteralPath $venvDirectory -Force).Attributes
        if (($venvAttributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'The project .venv is a linked directory; move or repair it manually before restarting.'
        }
        $resolvedVenvDirectory = (Resolve-Path -LiteralPath $venvDirectory).Path
    }
    $repoPrefix = [IO.Path]::GetFullPath($repoRoot).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if (-not $resolvedVenvDirectory.StartsWith($repoPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'The project virtual environment path is outside the repository.'
    }
    if (Test-Path -LiteralPath $venvDirectory) {
        Write-Output 'Rebuilding the unusable or unsupported project virtual environment...'
    } else {
        Write-Output 'Creating the project virtual environment...'
    }
    & $pythonPath @pythonArguments -m venv --clear $venvDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the virtual environment.' }
}

$venvVersionText = & $venvPython -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
if ($LASTEXITCODE -ne 0) {
    throw 'The project virtual environment could not start Python.'
}
try {
    $createdVenvVersion = [version]$venvVersionText
}
catch {
    throw 'The project virtual environment did not report a usable Python version.'
}
if ($createdVenvVersion -lt [version]'3.11') {
    throw 'The project virtual environment could not start Python 3.11 or later.'
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
