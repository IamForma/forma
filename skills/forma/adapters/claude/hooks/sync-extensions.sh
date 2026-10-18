#!/bin/sh
# PostToolUse (Claude adapter): a write into project/extensions/ copies the extensions into the engine folders
# (.forma/extensions/extensions.cjs); the adapter only calls the core script. Never blocks: exit 0.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
command -v node >/dev/null 2>&1 || exit 0
[ -f .forma/extensions/extensions.cjs ] || exit 0
input=$(cat)
file=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&(j.tool_input.file_path||j.tool_input.path))||"")}catch{}})')
case "$file" in
  *project[/\]extensions[/\]*) ;;
  *) exit 0 ;;
esac
node .forma/extensions/extensions.cjs sync >/dev/null 2>&1
exit 0
