#!/bin/sh
# SessionStart: says so when GitHub holds a newer version of the "Forma" plugin than the installed one.
#
# Why a hook, not a command or a cron. A command has to be remembered, which is exactly how an installed plugin
# fell dozens of versions behind unnoticed. A cron lives only inside a session here and dies with it, so it would
# have to be remembered too. A start hook needs nothing: it already fires by itself.
#
# Why `gh`, not `curl`. The plugin repository is private: an anonymous request to raw.githubusercontent answers
# 404 and the check would stay silent forever while looking alive. `gh` uses the authorization the human already has.
#
# Silent always, except one case: the version on GitHub is strictly newer than the installed one.
# No gh, no authorization, no network, an unparsed answer — it exits quietly.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

REPO="IamForma/forma"
STAMP=".claude/hooks/.plugin-check-stamp"
TODAY=$(date +%Y-%m-%d)

# At most once a day: the network on every session start is a delay for nothing.
[ -f "$STAMP" ] && [ "$(cat "$STAMP" 2>/dev/null)" = "$TODAY" ] && exit 0

command -v gh >/dev/null 2>&1 || exit 0

CACHE="$HOME/.claude/plugins/cache/forma/forma"
[ -d "$CACHE" ] || exit 0

# The installed version is the highest directory in the plugin cache (several may be there).
HAVE=$(ls "$CACHE" 2>/dev/null | grep -E '^[0-9]+(\.[0-9]+)*$' | sort -V | tail -1)
[ -n "$HAVE" ] || exit 0

WANT=$(gh api "repos/$REPO/contents/.claude-plugin/plugin.json" \
         -H "Accept: application/vnd.github.raw" 2>/dev/null \
       | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
[ -n "$WANT" ] || exit 0

# The stamp is set only after a successful answer, or an offline start would eat the day of checking.
printf '%s' "$TODAY" > "$STAMP" 2>/dev/null

# Strictly newer, not merely "different": in the source repository the local version runs ahead of the published
# one, and "update" there would be untrue.
NEWEST=$(printf '%s\n%s\n' "$HAVE" "$WANT" | sort -V | tail -1)
[ "$NEWEST" = "$HAVE" ] && exit 0

if command -v node >/dev/null 2>&1 && [ -f .forma/i18n/cli.cjs ]; then
  node .forma/i18n/cli.cjs msg hook.plugin_update have="$HAVE" want="$WANT"
else
  printf 'Plugin "Forma": installed %s, on GitHub %s.\n' "$HAVE" "$WANT"
fi
exit 0
