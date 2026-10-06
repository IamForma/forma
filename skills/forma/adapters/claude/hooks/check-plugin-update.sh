#!/bin/sh
# SessionStart: says so when GitHub holds a newer version of the "Forma" plugin than the installed one.
#
# Why a hook, not a command or a cron. A command has to be remembered, which is exactly how an installed plugin
# fell dozens of versions behind unnoticed. A cron lives only inside a session here and dies with it, so it would
# have to be remembered too. A start hook needs nothing: it already fires by itself.
#
# Where the installed version comes from. `.forma/install-manifest.json` is written by every install, by `npx` and by
# the plugin alike, so it is the version of the protocol in this project. Only without it the plugin cache is read.
#
# Where the published version comes from. `gh` first (it carries the human's authorization, so it works for a private
# repository too), then an anonymous `curl` to raw.githubusercontent — enough for the public repository and for a
# machine without `gh`.
#
# Versions carry a suffix (`0.4.186-alpha`): the numeric part is compared, the suffix is kept for display only.
#
# Silent always, except one case: the version on GitHub is strictly newer than the installed one.
# No gh, no authorization, no network, an unparsed answer — it exits quietly.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

REPO="IamForma/forma"
STAMP=".claude/hooks/.plugin-check-stamp"
TODAY=$(date +%Y-%m-%d)
VER_RE='[0-9][0-9]*\(\.[0-9][0-9]*\)*\(-[0-9A-Za-z.]*\)\{0,1\}'

# At most once a day: the network on every session start is a delay for nothing.
[ -f "$STAMP" ] && [ "$(cat "$STAMP" 2>/dev/null)" = "$TODAY" ] && exit 0

version_of() { sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\('"$VER_RE"'\)".*/\1/p' | head -1; }
core() { printf '%s' "${1%%-*}"; }

# Installed: the project's install manifest, else the highest version directory of the plugin cache.
SOURCE=npx
HAVE=
[ -f .forma/install-manifest.json ] && HAVE=$(version_of < .forma/install-manifest.json)
if [ -z "$HAVE" ]; then
  SOURCE=plugin
  CACHE="$HOME/.claude/plugins/cache/forma/forma"
  HAVE=$(ls "$CACHE" 2>/dev/null | grep -xE '[0-9]+(\.[0-9]+)*(-[0-9A-Za-z.]+)?' | sort -V | tail -1)
fi
[ -n "$HAVE" ] || exit 0

WANT=
if command -v gh >/dev/null 2>&1; then
  WANT=$(gh api "repos/$REPO/contents/.claude-plugin/plugin.json" \
           -H "Accept: application/vnd.github.raw" 2>/dev/null | version_of)
fi
if [ -z "$WANT" ] && command -v curl >/dev/null 2>&1; then
  WANT=$(curl -fsSL --max-time 5 "https://raw.githubusercontent.com/$REPO/main/.claude-plugin/plugin.json" 2>/dev/null | version_of)
fi
[ -n "$WANT" ] || exit 0

# The stamp is set only after a successful answer, or an offline start would eat the day of checking.
printf '%s' "$TODAY" > "$STAMP" 2>/dev/null

# Strictly newer, not merely "different": in the source repository the local version runs ahead of the published
# one, and "update" there would be untrue.
[ "$(core "$HAVE")" = "$(core "$WANT")" ] && exit 0
NEWEST=$(printf '%s\n%s\n' "$(core "$HAVE")" "$(core "$WANT")" | sort -V | tail -1)
[ "$NEWEST" = "$(core "$HAVE")" ] && exit 0

MSG=hook.plugin_update
[ "$SOURCE" = npx ] && MSG=hook.plugin_update_npx
if command -v node >/dev/null 2>&1 && [ -f .forma/i18n/cli.cjs ]; then
  node .forma/i18n/cli.cjs msg "$MSG" have="$HAVE" want="$WANT"
else
  printf 'Plugin "Forma": installed %s, on GitHub %s.\n' "$HAVE" "$WANT"
fi
exit 0
