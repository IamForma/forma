#!/bin/sh
# PostToolUse (Claude adapter): a write into a clean zone (prohibition 16) is checked for project traces at once,
# by the same function as sync-engines --check (--file mode). The report is printed in the project language
# (.forma/i18n). Never blocks: exit 0.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
command -v node >/dev/null 2>&1 || exit 0
[ -f .claude/scripts/sync-engines.cjs ] || exit 0
[ -f .forma/i18n/cli.cjs ] || exit 0
input=$(cat)
file=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&(j.tool_input.file_path||j.tool_input.path))||"")}catch{}})')
[ -z "$file" ] && exit 0
problems=$(node .claude/scripts/sync-engines.cjs --file "$file" 2>/dev/null)
[ -z "$problems" ] && exit 0
printf '%s' "$problems" | node .forma/i18n/cli.cjs hook-output PostToolUse hook.clean_zone_user hook.clean_zone_agent
exit 0
