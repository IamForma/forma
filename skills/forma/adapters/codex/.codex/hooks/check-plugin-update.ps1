# SessionStart: says so when GitHub holds a newer Forma version than the one installed in this project.
# Same logic as the Claude Code hook check-plugin-update.sh:
#   installed - "version" in .forma/install-manifest.json (written by every install);
#   published - .claude-plugin/plugin.json on main: `gh` first (works for a private repository too), then an anonymous
#               request to raw.githubusercontent;
#   versions carry a suffix (0.4.186-alpha): the numeric part is compared, the suffix is shown only.
# At most once a day; silent on any failure (no network, no answer, unparsed version). Windows PowerShell 5.1 compatible.
$ErrorActionPreference = 'Continue'
$stamp = Join-Path $PSScriptRoot '.plugin-check-stamp'
$today = (Get-Date).ToString('yyyy-MM-dd')
if ((Test-Path -LiteralPath $stamp) -and ((Get-Content -Raw $stamp).Trim() -eq $today)) { exit 0 }

$repoRoot = Split-Path -Parent (Split-Path $PSScriptRoot -Parent)
$repo = 'IamForma/forma'

function Get-Core([string]$v) {
    $c = ($v -split '-', 2)[0]
    try { return [version]$c } catch { return $null }
}

try {
    $manifest = Join-Path $repoRoot '.forma\install-manifest.json'
    if (-not (Test-Path -LiteralPath $manifest)) { exit 0 }
    $have = (Get-Content -Raw -Encoding UTF8 $manifest | ConvertFrom-Json).version
    if (-not $have) { exit 0 }

    $remoteJson = $null
    if (Get-Command gh -ErrorAction SilentlyContinue) {
        $remoteJson = (& gh api "repos/$repo/contents/.claude-plugin/plugin.json" -H 'Accept: application/vnd.github.raw' 2>$null) -join "`n"
        if ($LASTEXITCODE -ne 0) { $remoteJson = $null }
    }
    if (-not $remoteJson) {
        $remoteJson = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "https://raw.githubusercontent.com/$repo/main/.claude-plugin/plugin.json").Content
    }
    $want = ($remoteJson | ConvertFrom-Json).version
    if (-not $want) { exit 0 }

    # The stamp is set only after a successful answer, or an offline start would eat the day of checking.
    Set-Content -LiteralPath $stamp -Value $today -Encoding ASCII

    $haveCore = Get-Core $have
    $wantCore = Get-Core $want
    if (-not $haveCore -or -not $wantCore -or $wantCore -le $haveCore) { exit 0 }

    $cli = Join-Path $repoRoot '.forma\i18n\cli.cjs'
    if ((Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath $cli)) {
        & node $cli msg hook.plugin_update_npx "have=$have" "want=$want" --root $repoRoot
    } else {
        Write-Output "Forma: this project has $have, GitHub has $want. Update: run npx github:IamForma/forma init in the project folder."
    }
} catch {
    # Startup checks never block the session.
}
exit 0
