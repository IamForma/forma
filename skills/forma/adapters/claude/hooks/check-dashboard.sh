#!/bin/sh
# SessionStart: checks whether the dashboard (localhost:5050) is alive; if not, starts the watch.js supervisor in
# the background, which then watches serve.js and restarts it when it falls. Never blocks: the exit is always 0.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -f .forma/dashboard/ensure-running.js ] || exit 0
node .forma/dashboard/ensure-running.js 2>&1
exit 0
