#!/bin/sh
# SessionStart: feeds §8 "Engine architecture in Claude Code" from .claude/rules/claude-8.md into the session.
#
# Why a hook. This is a FALLBACK. Claude Code >= v2.1.277 loads .claude/rules/*.md (without `paths:`) and AGENTS.md
# natively (verified live on 2.1.291: §1-7 and §8 each arrive once, from the root and from any subdirectory).
# Register this hook only where native reading fails (older versions, Bedrock, telemetry disabled): registered while
# native reading works, it delivers §8 twice.
#
# No double delivery: while a CLAUDE.md sits in the root it carries §8 itself and the hook stays silent. That also
# makes the switch reversible: bring CLAUDE.md back and the hook turns off without any edit.
#
# Never blocks: the exit is always 0.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

RULES=".claude/rules/claude-8.md"
I18N=.forma/i18n/cli.cjs

# said CODE [k=v ...] — a message in the project language; without the catalog the code itself is printed
said() { if command -v node >/dev/null 2>&1 && [ -f "$I18N" ]; then node "$I18N" msg "$@"; else echo "$1"; fi; }

# A root CLAUDE.md in place carries §8 itself: nothing to print.
[ -f CLAUDE.md ] && exit 0

if [ ! -f "$RULES" ]; then
  said hook.no_section8 rules="$RULES"
  exit 0
fi

# The engine reads the law §1-7 from AGENTS.md itself; without it this is no longer about §8.
[ -f AGENTS.md ] || said hook.no_agents

cat "$RULES"
exit 0
