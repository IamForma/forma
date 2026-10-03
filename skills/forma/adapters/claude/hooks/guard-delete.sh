#!/bin/sh
# PreToolUse (Bash|PowerShell): блокирует команды, удаляющие или затирающие
# защищённые каталоги/файлы схемы, если рядом нет одноразовой метки-разрешения.
#
# Метку ставит хук UserPromptSubmit unlock-delete.sh, увидев в сообщении
# человека дословную фразу «Отключи сенсорику» — и только тогда. Хук пропускает следующий
# деструктивный вызов и сам стирает метку в этом же проходе: повторное
# удаление снова заблокировано по умолчанию, разрешение не остаётся висеть.
#
# Защищённые пути: .claude/, .agents/, .codex/, .devtool/, .forma/manual/, .forma/living/, VARS/,
# AGENTS.md, CLAUDE.md (если вернётся), PROJECT.md, любой GOAL.md. Обёртки движков
# (.agents/rules/gemini-8.md, .codex/CODEX-8.md) закрыты своими каталогами.
# Список согласован с человеком, правится тут же, без отдельного
# захода; корневой GEMINI.md убран вместе с самим файлом.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

[ -z "$CMD" ] && exit 0

# деструктивный глагол где-либо? (быстрый выход)
echo "$CMD" | grep -qiE '\brm\b|\brmdir\b|\bdel\b|\berase\b|\brd\b|\bri\b|Remove-Item|Clear-Content|-delete\b' || exit 0

# Текст против команды. Тела heredoc (<<WORD … WORD) и here-string
# PowerShell (@' … '@) выбрасываются; остаток режется на конвейеры по ; && || &
# и переводу строки вне кавычек. Дальше проверяется только конвейер, в котором
# деструктивный глагол стоит в позиции команды (после VAR=, sudo, env, xargs…):
# rm rmdir del erase rd ri Remove-Item Clear-Content, git rm/clean, find -delete/
# -exec rm. Оболочка (sh/bash/pwsh/eval/cmd) или $( ` в конвейере — он тоже
# проверяется целиком: строка там сама команда. `echo "rm .forma/manual/x"`,
# `git commit -m "rm .forma/manual/x"` — не удаление и проходят.
CAND=$(printf '%s\n' "$CMD" | awk '
function trim(s){ sub(/^[ \t({!]+/,"",s); return s }
function isverb(p,   n,w,i,k,x){
  n=split(trim(p),w,/[ \t]+/); i=1
  while(i<=n){ x=tolower(w[i]); sub(/.*[\/\\]/,"",x)
    if(x ~ /^[a-z_][a-z0-9_]*=/ || x=="sudo" || x=="command" || x=="builtin" || x=="exec" || x=="nohup" || x=="time" || x=="env" || x=="xargs" || x=="&" || x=="." || x ~ /^-/ ){ i++; continue }
    break }
  if(i>n) return 0
  sub(/\.exe$/,"",x)
  if(x ~ /^(rm|rmdir|del|erase|rd|ri|remove-item|clear-content)$/) return 1
  if(x ~ /^(sh|bash|zsh|dash|pwsh|powershell|eval|cmd|invoke-expression|iex)$/) return 1
  if(x=="git"){ for(k=i+1;k<=n;k++){ if(w[k] ~ /^-/) continue; return (tolower(w[k]) ~ /^(rm|clean)$/) } return 0 }
  if(x=="find") return (p ~ /-delete|-exec[ \t]+rm/)
  return 0 }
function emit(   m,parts,j,hit){
  if(cur ~ /[^ \t]/){ hit=(cur ~ /\$\(|`/)
    m=split(cur,parts,"\001"); for(j=1;j<=m;j++) if(isverb(parts[j])) hit=1
    if(hit){ gsub("\001","|",cur); print cur } }
  cur="" }
{
  line=$0
  if(hd!=""){ l=line; sub(/^[ \t]+/,"",l); sub(/[ \t\r]+$/,"",l); if(l==hd) hd=""; next }
  if(ps){ if(line ~ /^[ \t]*[\047"]@/) ps=0; next }
  L=length(line)
  for(i=1;i<=L;i++){ c=substr(line,i,1); nx=substr(line,i+1,1)
    if(q!=""){ if(c==q) q=""; else if(c=="\\" && q=="\""){ cur=cur c nx; i++; continue } cur=cur c; continue }
    if(c=="\\"){ cur=cur c nx; i++; continue }
    if(c=="\047" || c=="\""){ q=c; cur=cur c; continue }
    if(c==";"){ emit(); continue }
    if(c=="&"){ if(nx=="&") i++; else if(substr(cur,length(cur),1) ~ /[<>]/){ cur=cur c; continue } emit(); continue }
    if(c=="|"){ if(nx=="|"){ i++; emit() } else cur=cur "\001"; continue }
    cur=cur c }
  if(q!=""){ cur=cur " "; next }
  if(match(line,/<<-?[ \t]*[\047"]?[A-Za-z_][A-Za-z0-9_]*/)){ hd=substr(line,RSTART,RLENGTH); sub(/^<<-?[ \t]*[\047"]?/,"",hd) }
  if(line ~ /@[\047"][ \t\r]*$/) ps=1
  emit()
}
END{ emit() }')

[ -z "$CAND" ] && exit 0

# подстановка, способная раскрыться в защищённый путь? Правило: токен с * ? [
# блокируется, если (а) его первый сегмент (после ./), как шаблон, совпадает с
# защищённым корневым именем (`*`, `m*`, `.c*`, `VA?S`), или (б) шаблон
# накрывает существующий GOAL.md под своей неподстановочной частью (`G*`,
# `project/*/*.md`; `build/*` без GOAL.md — нет). Сравнение без учёта регистра.
# Рекурсия: при -r/-R/-rf/--recursive/-Recurse каталог аргумента
# (у шаблона — его неподстановочная часть: `project/*` → project) проверяется
# на GOAL.md внутри; найден — блок. `rm -rf build/*` без GOAL.md проходит.
set -f
PROT=".claude .agents .codex .devtool manual living vars agents.md claude.md project.md"
TOKS=$(printf '%s' "$CAND" | tr ' \t;|&()"<>'"'" '\n\n\n\n\n\n\n\n\n\n\n')
REC=
printf '%s' "$CAND" | grep -qiE '(^|[[:space:]])(-[a-z]*r[a-z]*|--recursive|-recurse)([[:space:]]|$)' && REC=1
for t in $TOKS; do
  case "$t" in -*|'['|'[['|']'|']]'|'$('*|'`'*) continue ;; esac
  if [ -n "$REC" ]; then
    d=${t%%[\*\?\[]*}; d=${d%/}; [ -z "$d" ] && d=.
    if [ -d "$d" ] && [ -n "$(find "$d" -iname GOAL.md 2>/dev/null | head -1)" ]; then GLOB_HIT=1; fi
  fi
  case "$t" in *[\*\?\[]*) ;; *) continue ;; esac
  t=$(printf '%s' "${t#./}" | tr '[:upper:]' '[:lower:]')
  first=${t%%/*}
  for n in $PROT; do case "$n" in $first) GLOB_HIT=1 ;; esac; done
  d=${t%%[\*\?\[]*}; d=${d%/}; [ -z "$d" ] && d=.
  for f in $(find "$d" -iname GOAL.md 2>/dev/null | tr '[:upper:]' '[:lower:]'); do
    case "${f#./}" in $t) GLOB_HIT=1 ;; esac
  done
done
set +f

# целится в защищённый путь? (границы слов — чтобы не ловить "user-manual", "manually" и т.п.)
echo "$CAND" | grep -qiE '\.claude/|\.agents/|\.codex/|\.devtool/|(^|[^A-Za-z0-9_-])manual([^A-Za-z0-9_-]|$)|(^|[^A-Za-z0-9_-])living([^A-Za-z0-9_-]|$)|(^|[^A-Za-z0-9_-])VARS([^A-Za-z0-9_-]|$)|AGENTS\.md|CLAUDE\.md|gemini-8\.md|CODEX-8\.md|PROJECT\.md|GOAL\.md' || [ -n "$GLOB_HIT" ] || exit 0

MARKER="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/.delete-unlock"

if [ -f "$MARKER" ]; then
  rm -f "$MARKER"
  exit 0
fi

echo "Заблокировано хуком guard-delete: команда похожа на удаление/затирание защищённого пути схемы ($CMD). Нужна явная команда человека «Отключи сенсорику» перед этим действием — без неё Bash/PowerShell не может физически удалить .claude/, .agents/, .codex/, .devtool/, .forma/manual/, .forma/living/, VARS/, AGENTS.md, CLAUDE.md, PROJECT.md или GOAL.md." >&2
exit 2
