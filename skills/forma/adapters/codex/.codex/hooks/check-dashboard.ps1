$ErrorActionPreference = 'Continue'
$repoRoot = Split-Path -Parent (Split-Path $PSScriptRoot -Parent)
$ensureScript = Join-Path $repoRoot 'dashboard\ensure-running.js'

if ((Test-Path -LiteralPath $ensureScript) -and (Get-Command node -ErrorAction SilentlyContinue)) {
    $output = & node $ensureScript 2>&1
    if ($LASTEXITCODE -ne 0 -and $output) {
        Write-Output ('Dashboard startup warning: ' + ($output -join ' '))
    }
}
exit 0
