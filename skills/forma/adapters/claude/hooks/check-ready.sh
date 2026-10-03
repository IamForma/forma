#!/bin/sh
# Напоминание о непроверенных местах. Только чтение, ничего не меняет.
# Молчит, когда всё заполнено. Никогда не блокирует: выход всегда 0.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
n=0
say=""

add() { n=$((n+1)); say="$say
  · $1"; }

# агенты — есть ли пять узлов и хоть один исполнитель
if [ -d .claude/agents ]; then
  for a in intent spec kit core; do
    [ -f ".claude/agents/$a.md" ] || add "agents: нет $a.md"
  done
  ls .claude/agents/run*.md >/dev/null 2>&1 || add "agents: нет ни одного исполнителя (run-*.md)"
else
  add "agents: папки .claude/agents нет"
fi

# где лежат файлы проекта: в корне (рабочий проект) или в project/ (репозиторий протокола)
P=PROJECT.md; M=ROADMAP.md; V=VARS
[ -f "$P" ] || { P=project/PROJECT.md; M=project/ROADMAP.md; V=project/VARS; }

# PROJECT.md
if [ -f "$P" ]; then
  if sed -n '/^| Порог/,/^$/p' "$P" | grep -qE '^\| [^|]+ \| *\|$'; then
    add "PROJECT.md: пороги заполнены не все"
  fi
fi

# язык проекта — определяет язык карточек (AGENTS.md §6); пусто, если после «*:» сразу пояснение шаблона
if [ -f "$P" ]; then
  lang=$(grep -m1 -E '^\*\*(Язык проекта|Project language)\*\*' "$P" | sed -E 's/^[^:]*\*: *//')
  case "$lang" in
    ""|Документация*|Documentation*) add "PROJECT.md: язык проекта не указан" ;;
  esac
fi

# ROADMAP.md
if [ ! -f "$M" ]; then
  add "ROADMAP.md: карты проекта нет"
elif grep -q '<имя>\|<Целое>' "$M"; then
  add "ROADMAP.md: карта не заполнена"
fi

# VARS/
[ -d "$V" ] || add "VARS/: папки величин нет"

# цели без GOAL.md
G=goals
[ -d "$G" ] || G=project/goals
if [ -d "$G" ]; then
  for d in "$G"/*/; do
    [ -d "$d" ] || continue
    [ -f "$d/GOAL.md" ] || add "${d}: нет GOAL.md"
  done
fi

# стоп старта (AGENTS.md §3): цели человека (4, 9) и пороги — без них круг не открывается
stop=""
if [ -d "$G" ]; then
  for c in result-image review-image; do
    gm="$G/goal-$c/GOAL.md"
    if [ ! -f "$gm" ] || grep -qE '^draft:[[:space:]]*true[[:space:]]*$' "$gm"; then
      stop="$stop
  · goal-$c: образ цели не сформирован человеком (draft)"
    fi
  done
fi
if [ -f "$P" ] && sed -n '/^| Порог/,/^$/p' "$P" | grep -qE '^\| [^|]+ \| *(не задан)? *\|$'; then
  stop="$stop
  · PROJECT.md: заданы не оба порога (заходы, объём)"
fi

# третий предел — только если подключены платные сервисы (строка в «Внешние сервисы» с пустым пределом)
if [ -f "$P" ] && sed -n '/^| Сервис |/,/^$/p' "$P" | grep -vE '^\| Сервис |^\|---' | grep -qE '\| *\|$'; then
  stop="$stop
  · PROJECT.md: у платного сервиса не задан предел на круг"
fi

# паритет сред (Claude Code <-> Gemini/Antigravity)
if [ -f .claude/scripts/sync-engines.cjs ]; then
  if ! node .claude/scripts/sync-engines.cjs --quiet >/dev/null 2>&1; then
    add "паритет сред: обнаружен дрейф правил (.claude/scripts/sync-engines.cjs --diff)"
  fi
fi

# счёт круга по эпикам и незапушенные коммиты протокола (AGENTS.md §7)
[ -f .claude/scripts/cycle-status.cjs ] && node .claude/scripts/cycle-status.cjs 2>/dev/null

[ -n "$stop" ] && printf 'СТОП СТАРТА — круг не открывается, сначала интервью с человеком (AGENTS.md §3):%s\n' "$stop"

[ "$n" -eq 0 ] && exit 0

printf 'Непроверенных мест: %s%s\n' "$n" "$say"
exit 0
