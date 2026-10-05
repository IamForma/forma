#!/bin/sh
# PreToolUse (all tools): appends one line to .forma/dashboard/tool-usage.log per tool call - who called and what.
# It decides nothing and never blocks: the exit is always 0, even when the hook itself is broken.
#
# Line:   YYYY-MM-DDTHH:MM · <node> · <agent_id> · <tool_name>
# Node  - the agent_type field of the input, lowercase (extractor, kit, run...). Calls of the shared session have no
#         such field: they are marked with the word `session` rather than merged with the nodes.
#
# WHY THE HOOK DOES NOT STAY SILENT WHEN IT BREAKS. The silence of a call and the silence of the log are different
# things and must not be confused when reading. So:
#   1. The log header is written when the file is created. No file - the hook has not run EVER: it is not
#      registered, not executable, or fell before the first write. A file with no lines under the header - the hook
#      is alive, there were no calls.
#   2. Its own breakage (empty input, no jq, input not JSON, no tool_name) does not vanish: instead of the usual line
#      a `!ERROR` line with the reason is written. The summary `.claude/scripts/tool-usage.cjs` counts such lines
#      separately and reports them aloud.
# The only case where the hook is truly silent is when it cannot even append to the file. Then point 1 speaks: a
# missing or frozen file.
# (Older logs carry `сессия` and `!ОШИБКА`; the readers accept both.)

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

LOG=".forma/dashboard/tool-usage.log"
TS=$(date +%Y-%m-%dT%H:%M 2>/dev/null)
[ -z "$TS" ] && TS="????-??-??T??:??"

INPUT=$(cat 2>/dev/null)

[ -d .forma/dashboard ] || mkdir -p .forma/dashboard 2>/dev/null || exit 0

if [ ! -f "$LOG" ]; then
  {
    echo "# Tool log by node - written by the hook .claude/hooks/tool-usage.sh"
    echo "# on every PreToolUse, append-only. Summary: node .claude/scripts/tool-usage.cjs"
    echo "#"
    echo "# Format: YYYY-MM-DDTHH:MM · node · agent_id · tool_name"
    echo "# Node \`session\` - a call of the shared session (no agent_type in the input)."
    echo "# Node \`!ERROR\` - the hook itself broke; the tool field holds the reason."
    echo "#"
    echo "# This file existing = the hook ran at least once. No file - the hook is not alive,"
    echo "# which is not the same as \"there were no calls\"."
    echo "#"
    echo "# ATTEMPTS HERE, NOT SUCCESSES. PreToolUse fires BEFORE the access decision:"
    echo "# a rejected call stands in the log on a par with an executed one. A line means"
    echo "# \"the node reached for the tool\", not \"the tool worked\". Emptiness for a tool"
    echo "# proves it is superfluous; non-emptiness does not prove the opposite."
  } >> "$LOG" 2>/dev/null || exit 0
fi

emit() {
  printf '%s\n' "$1" >> "$LOG" 2>/dev/null
  exit 0
}

if [ -z "$INPUT" ]; then
  emit "$TS · !ERROR · - · PreToolUse input is empty"
fi

FIELDS=$(printf '%s' "$INPUT" | jq -r '[(.agent_type // "session"), (.agent_id // "-"), (.tool_name // "-")] | join("\t")' 2>/dev/null)

if [ -z "$FIELDS" ]; then
  emit "$TS · !ERROR · - · input not parsed (no jq or input is not JSON)"
fi

OLDIFS=$IFS
IFS=$(printf '\t')
read -r AGENT_TYPE AGENT_ID TOOL_NAME <<EOF
$FIELDS
EOF
IFS=$OLDIFS

[ -z "$AGENT_TYPE" ] && AGENT_TYPE="session"
[ -z "$AGENT_ID" ] && AGENT_ID="-"

if [ -z "$TOOL_NAME" ] || [ "$TOOL_NAME" = "-" ]; then
  emit "$TS · !ERROR · $AGENT_ID · no tool_name in the input"
fi

emit "$TS · $AGENT_TYPE · $AGENT_ID · $TOOL_NAME"
