param([string]$InputPayload)
$ErrorActionPreference = 'Stop'

$inputText = $InputPayload
if ([string]::IsNullOrWhiteSpace($inputText) -and $null -ne $input) {
    $inputText = ($input | Out-String)
}
if ([string]::IsNullOrWhiteSpace($inputText)) {
    try {
        $inputText = [Console]::In.ReadToEnd()
    } catch {}
}
if ([string]::IsNullOrWhiteSpace($inputText)) { exit 0 }

try {
    $payload = $inputText | ConvertFrom-Json -ErrorAction Stop
} catch {
    exit 0
}

$toolInput = $payload.tool_input
$command = ''
if ($null -ne $toolInput) {
    if ($toolInput.PSObject.Properties.Name -contains 'command') {
        $command = [string]$toolInput.command
    } else {
        $command = $toolInput | ConvertTo-Json -Depth 20 -Compress
    }
}

if ([string]::IsNullOrWhiteSpace($command)) { exit 0 }

# Verbs as in Claude's guard-delete.sh: deletion, git clean/rm, find -delete, deletion from inline code of an interpreter
# (node -e, python -c ...), and moving out (mv, Move-Item, Rename-Item: a deletion of the source). `move`/`ren`/`mi` as
# bare words are left out: this hook sees the whole payload, patch text included, and prose says "move" often.
$destructive = $command -match '(?i)(\brm\b|\brmdir\b|\bdel\b|\berase\b|\brd\b|\bri\b|Remove-Item|Clear-Content|git\s+clean|git\s+rm|-delete\b|\bunlink\b|rmSync|\bfs\.(rm|rmdir)\b|rmtree|os\.(remove|rmdir)|FileUtils|File\.delete|\bmv\b|Move-Item|Rename-Item|\brni\b|\*\*\*\s+Delete File:)'
$protected = $command -match '(?i)((^|[^A-Za-z0-9_-])\.claude([\\/\s']|$)|(^|[^A-Za-z0-9_-])\.agents([\\/\s']|$)|(^|[^A-Za-z0-9_-])\.codex([\\/\s']|$)|(^|[^A-Za-z0-9_-])\.devtool([\\/\s']|$)|(^|[^A-Za-z0-9_-])\.forma([\\/\s']|$)|(^|[^A-Za-z0-9_-])manual([\\/\s']|$)|(^|[^A-Za-z0-9_-])living([\\/\s']|$)|(^|[^A-Za-z0-9_-])VARS([\\/\s']|$)|AGENTS\.md|CLAUDE\.md|gemini-8\.md|PROJECT\.md|CODEX-8\.md|GOAL\.md)'

if (-not ($destructive -and $protected)) { exit 0 }

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$marker = Join-Path $repoRoot '.codex\hooks\.delete-unlock'
if (Test-Path -LiteralPath $marker) {
    Remove-Item -LiteralPath $marker -Force
    exit 0
}

$reason = 'Destructive change to a protected Form path was blocked. The human must explicitly authorize a one-use deletion exception.'
@{
    hookSpecificOutput = @{
        hookEventName = 'PreToolUse'
        permissionDecision = 'deny'
        permissionDecisionReason = $reason
    }
} | ConvertTo-Json -Compress
