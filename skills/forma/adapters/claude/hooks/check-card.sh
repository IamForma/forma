#!/bin/sh
# PostToolUse (Claude adapter): a write into .devtool/features/ runs the core board check
# (.forma/board/check-board.cjs <card>) at once; the adapter only calls the core check.
# The report is printed in the project language (.forma/i18n). Never blocks: exit 0.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
command -v node >/dev/null 2>&1 || exit 0
[ -f .forma/board/check-board.cjs ] || exit 0
[ -f .forma/i18n/cli.cjs ] || exit 0
input=$(cat)
file=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&(j.tool_input.file_path||j.tool_input.path))||"")}catch{}})')
case "$file" in
  *.devtool[/\\]features[/\\]*.md) ;;
  *) exit 0 ;;
esac
id=$(basename "$file" .md)
problems=$(node .forma/board/check-board.cjs "$id" 2>&1)
[ -z "$problems" ] && exit 0
printf '%s' "$problems" | node .forma/i18n/cli.cjs hook-output PostToolUse hook.card_failed_user hook.card_failed_agent
exit 0
