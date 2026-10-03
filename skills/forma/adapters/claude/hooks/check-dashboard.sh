#!/bin/sh
# SessionStart: проверяет, жив ли дашборд (localhost:5050) — если нет,
# поднимает супервизор watch.js в фоне, который дальше сам следит за serve.js
# и перезапускает его при падении. Никогда не блокирует: exit всегда 0.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -f .forma/dashboard/ensure-running.js ] || exit 0
node .forma/dashboard/ensure-running.js 2>&1
exit 0
