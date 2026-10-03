$ErrorActionPreference = 'Continue'
$stamp = Join-Path $PSScriptRoot '.plugin-check-stamp'
$today = (Get-Date).ToString('yyyy-MM-dd')
if ((Test-Path -LiteralPath $stamp) -and ((Get-Content -Raw $stamp).Trim() -eq $today)) { exit 0 }

$repoRoot = Split-Path -Parent (Split-Path $PSScriptRoot -Parent)
$manifest = Join-Path $repoRoot 'infrastructure\forma-plugin\.claude-plugin\plugin.json'
if (-not (Test-Path -LiteralPath $manifest)) { exit 0 }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { exit 0 }

try {
    $localVersion = (Get-Content -Raw -Encoding UTF8 $manifest | ConvertFrom-Json).version
    $remoteJson = & gh api 'repos/iamformapro/forma/contents/.claude-plugin/plugin.json' -H 'Accept: application/vnd.github.raw+json' 2>$null
    if ($LASTEXITCODE -eq 0 -and $remoteJson) {
        $remoteVersion = ($remoteJson | ConvertFrom-Json).version
        if ($localVersion -and $remoteVersion -and $localVersion -ne $remoteVersion) {
            Write-Output "Forma plugin update available: local $localVersion, remote $remoteVersion."
        }
    }
} catch {
    # Startup checks never block the session.
}
Set-Content -LiteralPath $stamp -Value $today -Encoding ASCII
exit 0
