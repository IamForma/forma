#!/bin/sh
# Session-start reminder about unchecked places and the start gate (AGENTS.md §3). Read-only, never blocks: exit is always 0.
# The checks and the texts live in .forma/i18n (project-checks.cjs, messages/<lang>.json): the hook reads the
# project documents by English keys and prints in the project language, English as the fallback.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
command -v node >/dev/null 2>&1 || exit 0
I18N=.forma/i18n/cli.cjs
[ -f "$I18N" ] || exit 0

# cycle count per epic and unpushed protocol commits (AGENTS.md §7)
[ -f .claude/scripts/cycle-status.cjs ] && node .claude/scripts/cycle-status.cjs 2>/dev/null

# a postponed demo (later:<n>) counts this session start; at zero it is offered again
node "$I18N" demo-tick
node "$I18N" gate
node "$I18N" ready
exit 0
