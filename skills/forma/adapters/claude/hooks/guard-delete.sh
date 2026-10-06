#!/bin/sh
# PreToolUse (Bash|PowerShell): blocks commands that delete or overwrite the protected directories/files of the
# scheme unless a one-time permission marker sits beside them.
#
# The marker is set by the UserPromptSubmit hook unlock-delete.sh, on seeing the literal code phrase
# "Отключи сенсорику" in the human's message - and only then. This hook lets the next destructive call through
# and removes the marker in the same pass: the next deletion is blocked again by default, the permission never lingers.
#
# Protected paths: .claude/, .agents/, .codex/, .devtool/, .forma/manual/, .forma/living/, VARS/, AGENTS.md,
# CLAUDE.md (if it returns), PROJECT.md, any GOAL.md. The engine wrappers (.agents/rules/gemini-8.md,
# .codex/CODEX-8.md) are covered by their directories. The list is agreed with the human and edited right here.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

INPUT=$(cat)
# jq when present; otherwise node (always there: the installer runs on it). Git Bash on Windows ships without jq,
# and an unparsed input used to mean an empty command - every deletion passed.
if command -v jq >/dev/null 2>&1; then
  CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
else
  CMD=$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{try{const c=JSON.parse(s).tool_input;if(c&&typeof c.command==="string")process.stdout.write(c.command)}catch(e){}})' 2>/dev/null)
fi

[ -z "$CMD" ] && exit 0

# a destructive verb anywhere? (fast exit)
echo "$CMD" | grep -qiE '\brm\b|\brmdir\b|\bdel\b|\berase\b|\brd\b|\bri\b|Remove-Item|Clear-Content|-delete\b|\bclean\b|rmSync|unlink|rmtree|os\.remove|os\.rmdir|fs\.(rm|rmdir)\b|FileUtils|File\.delete|\bmv\b|\bmove\b|Move-Item|\bmi\b|Rename-Item|\bren\b' || exit 0

# Text versus command. Heredoc bodies (<<WORD ... WORD) and PowerShell here-strings (@' ... '@) are dropped; the rest
# is cut into pipelines at ; && || & and at line breaks outside quotes. Then only a pipeline where a destructive
# verb stands in the command position (after VAR=, sudo, env, xargs...) is checked: rm rmdir del erase rd ri
# Remove-Item Clear-Content, git rm/clean, find -delete / -exec rm. A shell (sh/bash/pwsh/eval/cmd) or $( ` in a
# pipeline is checked whole too: the string there is itself a command. So is an interpreter with inline code
# (node -e, python -c, perl -e, ruby -e, php -r): `node -e "fs.rmSync('.claude')"` is deletion by another hand.
# Moving out (mv, move, Move-Item, Rename-Item) is a deletion of the source: such a pipeline goes to a separate
# MV: line, and only its arguments before the last (the sources) are checked - `mv x .claude/x` is not blocked. `echo "rm .forma/manual/x"` and
# `git commit -m "rm .forma/manual/x"` are not deletion and pass.
CAND=$(printf '%s\n' "$CMD" | awk '
function trim(s){ sub(/^[ \t({!]+/,"",s); return s }
function isverb(p,   n,w,i,k,x){
  n=split(trim(p),w,/[ \t]+/); i=1
  while(i<=n){ x=tolower(w[i]); sub(/.*[\/\\]/,"",x)
    if(x ~ /^[a-z_][a-z0-9_]*=/ || x=="sudo" || x=="command" || x=="builtin" || x=="exec" || x=="nohup" || x=="time" || x=="env" || x=="xargs" || x=="&" || x=="." || x ~ /^-/ ){ i++; continue }
    break }
  if(i>n) return 0
  sub(/\.exe$/,"",x)
  if(x ~ /^(rm|rmdir|del|erase|rd|ri|remove-item|clear-content)$/) return 1
  if(x ~ /^(sh|bash|zsh|dash|pwsh|powershell|eval|cmd|invoke-expression|iex)$/) return 1
  if(x ~ /^(node|nodejs|deno|bun|python[0-9.]*|py|perl|ruby|php)$/){ for(k=i+1;k<=n;k++) if(w[k] ~ /^-(e|c|p|r|-eval|-print|-command)$/) return 1; return 0 }
  if(x=="git"){ for(k=i+1;k<=n;k++){ if(w[k] ~ /^-/) continue; return (tolower(w[k]) ~ /^(rm|clean)$/) } return 0 }
  if(x=="find") return (p ~ /-delete|-exec[ \t]+rm/)
  return 0 }
function ismv(p,   n,w,i,x){
  n=split(trim(p),w,/[ \t]+/); i=1
  while(i<=n){ x=tolower(w[i]); sub(/.*[\/\\]/,"",x)
    if(x ~ /^[a-z_][a-z0-9_]*=/ || x=="sudo" || x=="command" || x=="builtin" || x=="exec" || x=="nohup" || x=="time" || x=="env" || x=="xargs" || x=="&" || x=="." || x ~ /^-/ ){ i++; continue }
    break }
  if(i>n) return 0
  sub(/\.exe$/,"",x)
  return (x ~ /^(mv|move|move-item|mi|rename-item|ren|rni)$/) }
function emit(   m,parts,j,hit){
  if(cur ~ /[^ \t]/){ hit=(cur ~ /\$\(|`/)
    m=split(cur,parts,"\001"); for(j=1;j<=m;j++){ if(ismv(parts[j])) print "MV:" parts[j]; if(isverb(parts[j])) hit=1 }
    if(hit){ gsub("\001","|",cur); print cur } }
  cur="" }
{
  line=$0
  if(hd!=""){ l=line; sub(/^[ \t]+/,"",l); sub(/[ \t\r]+$/,"",l); if(l==hd) hd=""; next }
  if(ps){ if(line ~ /^[ \t]*[\047"]@/) ps=0; next }
  L=length(line)
  for(i=1;i<=L;i++){ c=substr(line,i,1); nx=substr(line,i+1,1)
    if(q!=""){ if(c==q) q=""; else if(c=="\\" && q=="\""){ cur=cur c nx; i++; continue } cur=cur c; continue }
    if(c=="\\"){ cur=cur c nx; i++; continue }
    if(c=="\047" || c=="\""){ q=c; cur=cur c; continue }
    if(c==";"){ emit(); continue }
    if(c=="&"){ if(nx=="&") i++; else if(substr(cur,length(cur),1) ~ /[<>]/){ cur=cur c; continue } emit(); continue }
    if(c=="|"){ if(nx=="|"){ i++; emit() } else cur=cur "\001"; continue }
    cur=cur c }
  if(q!=""){ cur=cur " "; next }
  if(match(line,/<<-?[ \t]*[\047"]?[A-Za-z_][A-Za-z0-9_]*/)){ hd=substr(line,RSTART,RLENGTH); sub(/^<<-?[ \t]*[\047"]?/,"",hd) }
  if(line ~ /@[\047"][ \t\r]*$/) ps=1
  emit()
}
END{ emit() }')

# Moves: the source arguments (all but the last, flags dropped) must not be protected. With `-t DIR` /
# `--target-directory DIR` the target is named by the flag, so every argument but DIR is a source.
PROTRE='\.(claude|agents|codex|devtool)([^A-Za-z0-9_-]|$)|\.forma/?([^A-Za-z0-9_./-]|$)|(^|[^A-Za-z0-9_-])manual([^A-Za-z0-9_-]|$)|(^|[^A-Za-z0-9_-])living([^A-Za-z0-9_-]|$)|(^|[^A-Za-z0-9_-])VARS([^A-Za-z0-9_-]|$)|AGENTS\.md|CLAUDE\.md|gemini-8\.md|CODEX-8\.md|PROJECT\.md|GOAL\.md'
MV_HIT=
MVSRC=$(printf '%s\n' "$CAND" | grep '^MV:' | while IFS= read -r l; do
  printf '%s\n' "$l" | sed 's/^MV://' | tr -d '"\047' | awk '{ n=0; t=0; for(i=1;i<=NF;i++){ if($i=="-t" || $i=="--target-directory"){ t=1; i++; continue } if($i ~ /^(-t.|--target-directory=)/) t=1; if($i ~ /^-/) continue; a[++n]=$i }
    for(i=2;i<=(t?n:n-1);i++) print a[i] }'
done)
[ -n "$MVSRC" ] && printf '%s\n' "$MVSRC" | grep -qiE "$PROTRE" && MV_HIT=1
CAND=$(printf '%s\n' "$CAND" | grep -v '^MV:')

[ -z "$CAND" ] && [ -z "$MV_HIT" ] && exit 0

# A glob that can expand to a protected path? Rule: a token with * ? [ is blocked if (a) its first segment (after ./),
# as a pattern, matches a protected root name (`*`, `m*`, `.c*`, `VA?S`), or (b) the pattern covers an existing
# GOAL.md under its non-glob part (`G*`, `project/*/*.md`; `build/*` without GOAL.md - no). Case-insensitive.
# Recursion: with -r/-R/-rf/--recursive/-Recurse the argument's directory (for a pattern, its non-glob part:
# `project/*` -> project) is checked for a GOAL.md inside; found - block. `rm -rf build/*` without GOAL.md passes.
set -f
PROT=".claude .agents .codex .devtool manual living vars agents.md claude.md project.md"
TOKS=$(printf '%s' "$CAND" | tr ' \t;|&()"<>'"'" '\n\n\n\n\n\n\n\n\n\n\n')
REC=
printf '%s' "$CAND" | grep -qiE '(^|[[:space:]])(-[a-z]*r[a-z]*|--recursive|-recurse)([[:space:]]|$)' && REC=1
# find -delete and git clean are recursive by nature; `git clean` without a path works on the whole tree.
printf '%s' "$CAND" | grep -qiE '(^|[^a-z])find[[:space:]].*-delete' && REC=1
if printf '%s' "$CAND" | grep -qiE '(^|[^a-z])git[[:space:]]+([^|]*[[:space:]])?clean([[:space:]]|$)'; then
  REC=1
  printf '%s' "$CAND" | sed 's/.*clean//' | tr ' \t' '\n\n' | grep -qvE '^(-.*|)$' || TOKS="$TOKS ."
fi
for t in $TOKS; do
  case "$t" in -*|'['|'[['|']'|']]'|'$('*|'`'*) continue ;; esac
  if [ -n "$REC" ]; then
    d=${t%%[\*\?\[]*}; d=${d%/}; [ -z "$d" ] && d=.
    if [ -d "$d" ] && [ -n "$(find "$d" -iname GOAL.md 2>/dev/null | head -1)" ]; then GLOB_HIT=1; fi
    # the directory holds a protected root itself (`rm -rf .`, `find . -delete`, `git clean -fdx`)
    for r in .claude .agents .codex .devtool .forma AGENTS.md; do [ -e "$d/$r" ] && GLOB_HIT=1; done
  fi
  case "$t" in *[\*\?\[]*) ;; *) continue ;; esac
  t=$(printf '%s' "${t#./}" | tr '[:upper:]' '[:lower:]')
  first=${t%%/*}
  for n in $PROT; do case "$n" in $first) GLOB_HIT=1 ;; esac; done
  d=${t%%[\*\?\[]*}; d=${d%/}; [ -z "$d" ] && d=.
  for f in $(find "$d" -iname GOAL.md 2>/dev/null | tr '[:upper:]' '[:lower:]'); do
    case "${f#./}" in $t) GLOB_HIT=1 ;; esac
  done
done
set +f

# aims at a protected path? (word boundaries, so "user-manual", "manually" and the like are not caught)
echo "$CAND" | grep -qiE "$PROTRE" || [ -n "$GLOB_HIT" ] || [ -n "$MV_HIT" ] || exit 0

MARKER="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/.delete-unlock"

if [ -f "$MARKER" ]; then
  rm -f "$MARKER"
  exit 0
fi

if command -v node >/dev/null 2>&1 && [ -f .forma/i18n/cli.cjs ]; then
  node .forma/i18n/cli.cjs msg hook.delete_blocked cmd="$CMD" >&2
else
  echo "Blocked by the guard-delete hook: the command looks like deleting or overwriting a protected path ($CMD)." >&2
fi
exit 2
