param([string]$InputPayload)
$ErrorActionPreference = 'SilentlyContinue'

$inputText = $InputPayload
if ([string]::IsNullOrWhiteSpace($inputText) -and $null -ne $input) {
    $inputText = ($input | Out-String)
}
if ([string]::IsNullOrWhiteSpace($inputText)) {
    try { $inputText = [Console]::In.ReadToEnd() } catch {}
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$dashboard = Join-Path $repoRoot '.forma/dashboard'
$log = Join-Path $dashboard 'tool-usage.log'
New-Item -ItemType Directory -Force -Path $dashboard | Out-Null

$dot = [char]0x00B7
$errorNode = '!' + ((0x041E,0x0428,0x0418,0x0411,0x041A,0x0410 | ForEach-Object { [char]$_ }) -join '')
if (-not (Test-Path -LiteralPath $log)) {
    @(
        '# Tool journal by node - written by .codex/hooks/tool-usage.ps1',
        '# One append per PreToolUse. Summary: node .claude/scripts/tool-usage.cjs',
        '#',
        "# Format: YYYY-MM-DDTHH:MM $dot node $dot agent_id $dot tool_name",
        "# Node session means the main session; $errorNode means malformed hook input."
    ) | Set-Content -LiteralPath $log -Encoding UTF8
}

$timestamp = Get-Date -Format 'yyyy-MM-ddTHH:mm'
if ([string]::IsNullOrWhiteSpace($inputText)) {
    Add-Content -LiteralPath $log -Value "$timestamp $dot $errorNode $dot - $dot empty PreToolUse input" -Encoding UTF8
    exit 0
}

try { $payload = $inputText | ConvertFrom-Json -ErrorAction Stop } catch {
    Add-Content -LiteralPath $log -Value "$timestamp $dot $errorNode $dot - $dot input is not JSON" -Encoding UTF8
    exit 0
}

$node = if ($payload.agent_type) { [string]$payload.agent_type } else { 'session' }
$agentId = if ($payload.agent_id) { [string]$payload.agent_id } else { '-' }
$toolName = if ($payload.tool_name) { [string]$payload.tool_name } else { '' }
if ([string]::IsNullOrWhiteSpace($toolName)) {
    Add-Content -LiteralPath $log -Value "$timestamp $dot $errorNode $dot $agentId $dot missing tool_name" -Encoding UTF8
    exit 0
}

Add-Content -LiteralPath $log -Value "$timestamp $dot $node $dot $agentId $dot $toolName" -Encoding UTF8
exit 0
