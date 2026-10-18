# Codex check-card: обёртка над .codex/scripts/codex-hooks.cjs (AGENTS.md §1, .codex/CODEX-8.md). Никогда не блокирует.
$repoRoot = Split-Path -Parent (Split-Path $PSScriptRoot -Parent)
if (Get-Command node -ErrorAction SilentlyContinue) { $input | & node (Join-Path $repoRoot '.codex\scripts\codex-hooks.cjs') check-card }
exit 0
