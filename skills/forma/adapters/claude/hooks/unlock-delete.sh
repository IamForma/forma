#!/bin/sh
# UserPromptSubmit: the human's code phrase "Отключи сенсорику" -> a one-time marker
# .claude/hooks/.delete-unlock for guard-delete.sh (AGENTS.md §2).
# The prompt field is the human's message only: the agent's text does not get here.
# "Подключи сенсорику" does not fire: no letter may stand before "отключи".
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
HIT=$(jq -r '(.prompt // "") | test("(^|[^А-Яа-яЁёA-Za-z])[Оо]тключи сенсорику")' 2>/dev/null)
[ "$HIT" = "true" ] && : > .claude/hooks/.delete-unlock
exit 0
