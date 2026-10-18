$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path $PSScriptRoot -Parent)
$codexRoot = Join-Path $repoRoot '.codex'

function Require-Text([string]$Path, [string]$Pattern, [string]$Message) {
    if (-not (Select-String -Path $Path -Pattern $Pattern -Quiet)) { throw $Message }
}

function Invoke-Guard([string]$Guard, [string]$Payload) {
    $out = @(& $Guard -InputPayload $Payload) -join "`n"
    return [pscustomobject]@{ Output = $out; Error = ''; ExitCode = $LASTEXITCODE }
}

$config = Join-Path $codexRoot 'config.toml'
$appendix = Join-Path $codexRoot 'CODEX-8.md'
$compat = Join-Path $codexRoot 'CLAUDE-COMPAT.md'
if (-not (Test-Path -LiteralPath $appendix)) { throw 'Missing Codex §8 appendix.' }
if (-not (Test-Path -LiteralPath $compat)) { throw 'Missing Claude compatibility contract.' }
Require-Text $config '^max_concurrent_threads_per_session = 3$' 'Child-thread cap must be three.'
Require-Text $config 'CODEX-8\.md' 'Root developer instructions must point to Codex §8.'
Require-Text $config 'CLAUDE-COMPAT\.md' 'Root developer instructions must point to the compatibility contract.'

$agents = 'intent', 'spec', 'kit', 'run', 'core'
foreach ($agent in $agents) {
    $toml = Join-Path $codexRoot "agents\$agent.toml"
    $role = Join-Path $codexRoot "roles\$agent.md"
    if (-not (Test-Path -LiteralPath $toml)) { throw "Missing agent definition: $agent" }
    if (-not (Test-Path -LiteralPath $role)) { throw "Missing Codex role adapter: $agent" }
    foreach ($field in 'name', 'description', 'model', 'model_reasoning_effort', 'developer_instructions') {
        Require-Text $toml ("(?m)^" + $field + '\s*=') "Agent $agent is missing $field."
    }
    Require-Text $toml 'CODEX-8\.md' "Agent $agent does not point to Codex §8."
    Require-Text $toml 'CLAUDE-COMPAT\.md' "Agent $agent does not point to the compatibility contract."
    Require-Text $toml ("\.claude/agents/" + $agent + '\.md') "Agent $agent does not point to its canonical Claude role."
    Require-Text $toml ("roles/" + $agent + '\.md') "Agent $agent does not point to its Codex adapter."
    Require-Text $role ("\.claude/agents/" + $agent + '\.md') "Adapter $agent does not point to its canonical Claude role."
}

foreach ($name in 'citing-schema-to-human', 'intent-goal-opening', 'intent-housekeeping', 'kit-project-kitting', 'kit-recon', 'run-external-model') {
    $adapter = Join-Path $codexRoot "roles\on-demand\$name.md"
    if (-not (Test-Path -LiteralPath $adapter)) { throw "Missing on-demand adapter: $name" }
    Require-Text $adapter ("\.claude/agents/on-demand/" + $name + '\.md') "On-demand adapter $name has no canonical source."
}

foreach ($path in 'agents\extractor.toml', 'roles\extractor.md') {
    if (-not (Test-Path -LiteralPath (Join-Path $codexRoot $path))) { throw "Missing extractor component: $path" }
}

$hooksPath = Join-Path $codexRoot 'hooks.json'
$hooks = Get-Content -Raw -Encoding UTF8 $hooksPath | ConvertFrom-Json
if ($hooks.PreToolUse.Count -lt 1) { throw 'No PreToolUse hook is configured.' }
if ($hooks.SessionStart.Count -lt 1) { throw 'No SessionStart hook is configured.' }
$startupCommands = @($hooks.SessionStart[0].hooks | ForEach-Object { $_.command }) -join "`n"
foreach ($script in 'check-ready.ps1', 'check-dashboard.ps1', 'check-plugin-update.ps1') {
    if ($startupCommands -notmatch [regex]::Escape($script)) { throw "SessionStart is missing $script." }
    if (-not (Test-Path -LiteralPath (Join-Path $codexRoot "hooks\$script"))) { throw "Missing hook script: $script" }
}
$preToolCommands = @($hooks.PreToolUse | ForEach-Object { $_.hooks } | ForEach-Object { $_.command }) -join "`n"
foreach ($script in 'guard-delete.ps1', 'tool-usage.ps1') {
    if ($preToolCommands -notmatch [regex]::Escape($script)) { throw "PreToolUse is missing $script." }
    if (-not (Test-Path -LiteralPath (Join-Path $codexRoot "hooks\$script"))) { throw "Missing hook script: $script" }
}
$guard = Join-Path $codexRoot 'hooks\guard-delete.ps1'

$denyPayload = '{"tool_name":"Bash","tool_input":{"command":"Remove-Item .codex -Recurse -Force"}}'
$denyOutput = Invoke-Guard $guard $denyPayload
if ($denyOutput.Output -notmatch '"permissionDecision":"deny"') { throw "Deletion guard did not deny a protected delete (exit $($denyOutput.ExitCode), stdout [$($denyOutput.Output)], stderr [$($denyOutput.Error)])." }

$nestedPayload = '{"tool_name":"Bash","tool_input":{"command":"Remove-Item .codex/hooks -Recurse -Force"}}'
if ((Invoke-Guard $guard $nestedPayload).Output -notmatch '"permissionDecision":"deny"') { throw 'Deletion guard did not deny a protected nested delete.' }

$allowPayload = '{"tool_name":"Bash","tool_input":{"command":"Get-ChildItem .codex"}}'
$allowOutput = Invoke-Guard $guard $allowPayload
if (-not [string]::IsNullOrWhiteSpace($allowOutput.Output)) { throw 'Deletion guard unexpectedly blocked a safe read.' }

$fixture = Join-Path ([IO.Path]::GetTempPath()) ("forma-guard-" + [guid]::NewGuid().ToString('N'))
try {
    $fixtureHooks = Join-Path $fixture '.codex\hooks'
    New-Item -ItemType Directory -Force -Path $fixtureHooks | Out-Null
    $fixtureGuard = Join-Path $fixtureHooks 'guard-delete.ps1'
    Copy-Item -LiteralPath $guard -Destination $fixtureGuard
    $marker = Join-Path $fixtureHooks '.delete-unlock'
    Set-Content -LiteralPath $marker -Value 'one use' -Encoding UTF8
    $first = Invoke-Guard $fixtureGuard $denyPayload
    if (-not [string]::IsNullOrWhiteSpace($first.Output)) { throw 'One-use guard marker did not allow the first protected delete.' }
    if (Test-Path -LiteralPath $marker) { throw 'One-use guard marker was not consumed.' }
    $second = Invoke-Guard $fixtureGuard $denyPayload
    if ($second.Output -notmatch '"permissionDecision":"deny"') { throw 'Guard did not deny the second protected delete after consuming the marker.' }

    $fixtureToolUsage = Join-Path $fixtureHooks 'tool-usage.ps1'
    Copy-Item -LiteralPath (Join-Path $codexRoot 'hooks\tool-usage.ps1') -Destination $fixtureToolUsage
    $toolPayload = '{"agent_type":"kit","agent_id":"fixture-agent","tool_name":"apply_patch"}'
    & $fixtureToolUsage -InputPayload $toolPayload
    $toolLog = Join-Path $fixture 'dashboard\tool-usage.log'
    if (-not (Test-Path -LiteralPath $toolLog)) { throw 'Tool-usage hook did not create its journal.' }
    $toolText = Get-Content -Raw -LiteralPath $toolLog
    if ($toolText -notmatch 'kit.*fixture-agent.*apply_patch') { throw "Tool-usage hook did not record node, call id, and tool name. Journal: [$toolText]" }
} finally {
    if (Test-Path -LiteralPath $fixture) { Remove-Item -LiteralPath $fixture -Recurse -Force }
}

Write-Output 'Codex configuration verified.'
