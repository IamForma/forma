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

$destructive = $command -match '(?i)(\brm\b|\brmdir\b|\bdel\b|\berase\b|Remove-Item|Clear-Content|git\s+clean|git\s+rm|\*\*\*\s+Delete File:)'
$protected = $command -match '(?i)((^|[^A-Za-z0-9_-])\.claude([\\/\s]|$)|(^|[^A-Za-z0-9_-])\.agents([\\/\s]|$)|(^|[^A-Za-z0-9_-])\.codex([\\/\s]|$)|(^|[^A-Za-z0-9_-])\.devtool([\\/\s]|$)|(^|[^A-Za-z0-9_-])manual([\\/\s]|$)|(^|[^A-Za-z0-9_-])living([\\/\s]|$)|(^|[^A-Za-z0-9_-])VARS([\\/\s]|$)|AGENTS\.md|CLAUDE\.md|gemini-8\.md|PROJECT\.md|CODEX-8\.md|GOAL\.md)'

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
