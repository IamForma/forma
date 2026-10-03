$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path $PSScriptRoot -Parent)
$codexRoot = Join-Path $repoRoot '.codex'

function Require-Text([string]$Path, [string]$Pattern, [string]$Message) {
    if (-not (Select-String -Path $Path -Pattern $Pattern -Quiet)) { throw $Message }
}

$config = Join-Path $codexRoot 'config.toml'
foreach ($path in 'CODEX-8.md', 'CLAUDE-COMPAT.md') {
    if (-not (Test-Path -LiteralPath (Join-Path $codexRoot $path))) { throw "Missing $path." }
}
Require-Text $config '^max_concurrent_threads_per_session = 3$' 'Child-thread cap must be three.'
Require-Text $config 'CODEX-8\.md' 'Root instructions do not point to CODEX-8.'
Require-Text $config 'CLAUDE-COMPAT\.md' 'Root instructions do not point to the compatibility contract.'

foreach ($agent in 'intent', 'spec', 'kit', 'run', 'core') {
    $toml = Join-Path $codexRoot "agents\$agent.toml"
    $adapter = Join-Path $codexRoot "roles\$agent.md"
    foreach ($path in $toml, $adapter, (Join-Path $repoRoot ".claude\agents\$agent.md")) {
        if (-not (Test-Path -LiteralPath $path)) { throw "Missing role component: $path" }
    }
    foreach ($field in 'name', 'description', 'model', 'model_reasoning_effort', 'sandbox_mode', 'developer_instructions') {
        Require-Text $toml ("(?m)^" + $field + '\s*=') "Agent $agent is missing $field."
    }
    Require-Text $toml 'CLAUDE-COMPAT\.md' "Agent $agent has no compatibility contract."
    Require-Text $toml ("\.claude/agents/" + $agent + '\.md') "Agent $agent has no canonical Claude role."
    Require-Text $adapter ("\.claude/agents/" + $agent + '\.md') "Adapter $agent has no canonical Claude role."
}

foreach ($name in 'citing-schema-to-human', 'intent-goal-opening', 'intent-housekeeping', 'kit-project-kitting', 'kit-recon', 'run-external-model') {
    $adapter = Join-Path $codexRoot "roles\on-demand\$name.md"
    if (-not (Test-Path -LiteralPath $adapter)) { throw "Missing on-demand adapter: $name" }
    Require-Text $adapter ("\.claude/agents/on-demand/" + $name + '\.md') "On-demand adapter $name has no canonical source."
}

$claudeSkills = Join-Path $repoRoot '.claude\skills'
$codexSkills = Join-Path $repoRoot '.agents\skills'
$sourceNames = @(Get-ChildItem -LiteralPath $claudeSkills -Directory | Select-Object -ExpandProperty Name | Sort-Object)
foreach ($name in $sourceNames) {
    $source = Join-Path $claudeSkills $name
    $target = Join-Path $codexSkills $name
    if (-not (Test-Path -LiteralPath $target)) { throw "Codex skill mirror is missing: $name" }
    $sourceFiles = @(Get-ChildItem -LiteralPath $source -Recurse -File | ForEach-Object { $_.FullName.Substring($source.Length).TrimStart('\','/') } | Sort-Object)
    $targetFiles = @(Get-ChildItem -LiteralPath $target -Recurse -File | ForEach-Object { $_.FullName.Substring($target.Length).TrimStart('\','/') } | Sort-Object)
    if (($sourceFiles -join "`n") -ne ($targetFiles -join "`n")) { throw "Codex skill mirror has a different file set: $name" }
    foreach ($relative in $sourceFiles) {
        $sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $source $relative)).Hash
        $targetHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $target $relative)).Hash
        if ($sourceHash -ne $targetHash) { throw "Codex skill mirror differs from Claude: $name/$relative" }
    }
}

foreach ($path in 'agents\extractor.toml', 'roles\extractor.md') {
    if (-not (Test-Path -LiteralPath (Join-Path $codexRoot $path))) { throw "Missing extractor component: $path" }
}

$hooks = Get-Content -Raw -Encoding UTF8 (Join-Path $codexRoot 'hooks.json') | ConvertFrom-Json
if ($hooks.PreToolUse.Count -lt 1) { throw 'No PreToolUse hook.' }
if ($hooks.SessionStart.Count -lt 1) { throw 'No SessionStart hook.' }
$startupCommands = @($hooks.SessionStart[0].hooks | ForEach-Object { $_.command }) -join "`n"
foreach ($script in 'check-ready.ps1', 'check-dashboard.ps1', 'check-plugin-update.ps1') {
    if ($startupCommands -notmatch [regex]::Escape($script)) { throw "SessionStart is missing $script." }
    if (-not (Test-Path -LiteralPath (Join-Path $codexRoot "hooks\$script"))) { throw "Missing hook script: $script" }
}

Write-Output 'Codex-to-Claude configuration parity verified.'
