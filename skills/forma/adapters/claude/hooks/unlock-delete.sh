#!/bin/sh
# UserPromptSubmit: код-фраза человека «Отключи сенсорику» → одноразовая метка
# .claude/hooks/.delete-unlock для guard-delete.sh (AGENTS.md §2).
# Поле prompt — только сообщение человека: текст агента сюда не попадает.
# «Подключи сенсорику» не срабатывает: перед «отключи» не должно быть буквы.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
HIT=$(jq -r '(.prompt // "") | test("(^|[^А-Яа-яЁёA-Za-z])[Оо]тключи сенсорику")' 2>/dev/null)
[ "$HIT" = "true" ] && : > .claude/hooks/.delete-unlock
exit 0
