$ErrorActionPreference = 'Continue'
$repoRoot = Split-Path -Parent (Split-Path $PSScriptRoot -Parent)
$warnings = [System.Collections.Generic.List[string]]::new()

foreach ($role in 'intent', 'spec', 'kit', 'run', 'core') {
    foreach ($path in @(
        (Join-Path $repoRoot ".claude\agents\$role.md"),
        (Join-Path $repoRoot ".codex\agents\$role.toml"),
        (Join-Path $repoRoot ".codex\roles\$role.md")
    )) {
        if (-not (Test-Path -LiteralPath $path)) { $warnings.Add("missing role component: $path") }
    }
}

foreach ($path in @(
    (@('project\config\PROJECT.md', 'project\PROJECT.md') | ForEach-Object { Join-Path $repoRoot $_ } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1),
    (@('project\ops\ROADMAP.md', 'project\ROADMAP.md') | ForEach-Object { Join-Path $repoRoot $_ } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1),
    (Join-Path $repoRoot 'VARS'),
    (Join-Path $repoRoot '.codex\CODEX-8.md'),
    (Join-Path $repoRoot '.codex\CLAUDE-COMPAT.md')
)) {
    if (-not (Test-Path -LiteralPath $path)) { $warnings.Add("missing project component: $path") }
}

$syncScript = Join-Path $repoRoot '.claude\scripts\sync-engines.cjs'
if ((Test-Path -LiteralPath $syncScript) -and (Get-Command node -ErrorAction SilentlyContinue)) {
    $syncOutput = & node $syncScript --quiet 2>&1
    if ($LASTEXITCODE -ne 0 -and $syncOutput) { $warnings.Add(($syncOutput -join [Environment]::NewLine)) }
}

if ($warnings.Count -gt 0) {
    Write-Output ('Codex readiness warnings:' + [Environment]::NewLine + (($warnings | ForEach-Object { '- ' + $_ }) -join [Environment]::NewLine))
}
exit 0
