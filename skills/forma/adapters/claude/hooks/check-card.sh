#!/bin/sh
# PostToolUse (адаптер Claude): запись в .devtool/features/ — сразу проверка доски
# ядром (.forma/board/check-board.cjs <карточка>) — адаптер Claude только вызывает проверку ядра.
# Никогда не блокирует: exit 0.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
command -v node >/dev/null 2>&1 || exit 0
[ -f .forma/board/check-board.cjs ] || exit 0
input=$(cat)
file=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&(j.tool_input.file_path||j.tool_input.path))||"")}catch{}})')
case "$file" in
  *.devtool[/\\]features[/\\]*.md) ;;
  *) exit 0 ;;
esac
id=$(basename "$file" .md)
problems=$(node .forma/board/check-board.cjs "$id" 2>&1)
[ -z "$problems" ] && exit 0
node -e 'process.stdout.write(JSON.stringify({systemMessage:"Карточка не прошла проверку доски:\n"+process.argv[1],hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:"Карточка не прошла проверку доски (.forma/board/check-board.cjs), исправь сейчас:\n"+process.argv[1]}}))' "$problems"
exit 0
