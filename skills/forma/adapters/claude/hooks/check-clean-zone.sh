#!/bin/sh
# PostToolUse (адаптер Claude): запись в чистую зону (запрет 16) — сразу проверка следов проекта
# той же функцией, что sync-engines --check (режим --file). Никогда не блокирует: exit 0.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
command -v node >/dev/null 2>&1 || exit 0
[ -f .claude/scripts/sync-engines.cjs ] || exit 0
input=$(cat)
file=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&(j.tool_input.file_path||j.tool_input.path))||"")}catch{}})')
[ -z "$file" ] && exit 0
problems=$(node .claude/scripts/sync-engines.cjs --file "$file" 2>/dev/null)
[ -z "$problems" ] && exit 0
node -e 'process.stdout.write(JSON.stringify({systemMessage:"След проекта в чистой зоне (запрет 16):\n"+process.argv[1],hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:"Запись оставила след проекта в чистой зоне (запрет 16, AGENTS.md §5), убери сейчас:\n"+process.argv[1]}}))' "$problems"
exit 0
