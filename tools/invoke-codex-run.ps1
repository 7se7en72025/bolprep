param(
    [Parameter(Mandatory = $true)]
    [string]$ConfigPath
)

$ErrorActionPreference = 'Stop'
$config = Get-Content -Raw -LiteralPath $ConfigPath | ConvertFrom-Json
$codexArguments = @($config.arguments)

try {
    & $config.codex_path @codexArguments 1> $config.stdout_path 2> $config.stderr_path
    exit $LASTEXITCODE
}
catch {
    Add-Content -LiteralPath $config.stderr_path -Value $_.ToString() -Encoding utf8
    exit 1
}
