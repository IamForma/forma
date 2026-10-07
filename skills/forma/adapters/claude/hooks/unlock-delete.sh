#!/bin/sh
# UserPromptSubmit: the human's code phrase "Отключи сенсорику" -> a one-time marker
# .claude/hooks/.delete-unlock for guard-delete.sh (AGENTS.md §2).
# The prompt field is the human's message only: the agent's text does not get here.
# "Подключи сенсорику" does not fire: no letter may stand before "отключи".
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
# jq when present; otherwise node (Git Bash on Windows ships without jq).
if command -v jq >/dev/null 2>&1; then
  HIT=$(jq -r '(.prompt // "") | test("(^|[^А-Яа-яЁёA-Za-z])[Оо]тключи сенсорику")' 2>/dev/null)
else
  HIT=$(node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{try{const p=JSON.parse(s).prompt||"";process.stdout.write(String(/(^|[^А-Яа-яЁёA-Za-z])[Оо]тключи сенсорику/.test(p)))}catch(e){}})' 2>/dev/null)
fi
[ "$HIT" = "true" ] && : > .claude/hooks/.delete-unlock
exit 0
