#!/bin/sh
# PostToolUse (Write|Edit): a write into a graph source marks the graphs dirty; one debounced worker rebuilds them
# (.claude/scripts/auto-graphs.cjs, no model). Writes into the graphs themselves and the caches are ignored (no loop).
# Never blocks: exit 0.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
command -v node >/dev/null 2>&1 || exit 0
[ -f .claude/scripts/auto-graphs.cjs ] || exit 0
input=$(cat)
file=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&(j.tool_input.file_path||j.tool_input.path))||"")}catch(e){}})' 2>/dev/null)
file=$(printf '%s' "$file" | tr '\\' '/')
case "$file" in
  *.forma/living/graphs/*|*.forma/dashboard/.cache/*|*node_modules/*|*project/cards/*|*project/work/*) exit 0 ;;
  *.devtool/features/*|*/project/*|*/.claude/*|*/.forma/manual/*) ;;
  *) exit 0 ;;
esac
node .claude/scripts/auto-graphs.cjs touch >/dev/null 2>&1
exit 0
