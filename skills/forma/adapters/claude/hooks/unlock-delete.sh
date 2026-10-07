#!/bin/sh
# UserPromptSubmit: the human's code phrase "Отключи сенсорику" (or its translation: English "Disable the sensors",
# German, French, Spanish, Ukrainian, Chinese - list below) -> a one-time marker .claude/hooks/.delete-unlock for
# guard-delete.sh (AGENTS.md §2). The phrase list is AGENTS.md §2 and the installer banner; add a language in all three.
# The prompt field is the human's message only: the agent's text does not get here.
# "Подключи сенсорику" does not fire: no letter may stand before the phrase. Case does not matter.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
RE='(^|[^А-Яа-яЁёІіЇїЄєҐґA-Za-zÀ-ÿ])((отключи|вимкни) сенсорику|disable (the )?sensor(s|ics)|(deaktiviere (die )?sensorik|sensorik deaktivieren)|d[ée]sactive (les )?capteurs|desactiva (los )?sensores)|关闭传感器'
# jq when present; otherwise node (Git Bash on Windows ships without jq).
if command -v jq >/dev/null 2>&1; then
  HIT=$(jq -r --arg re "$RE" '(.prompt // "") | test($re; "i")' 2>/dev/null)
else
  HIT=$(node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{try{const p=JSON.parse(s).prompt||"";process.stdout.write(String(new RegExp(process.argv[1],"i").test(p)))}catch(e){}})' "$RE" 2>/dev/null)
fi
[ "$HIT" = "true" ] && : > .claude/hooks/.delete-unlock
exit 0
