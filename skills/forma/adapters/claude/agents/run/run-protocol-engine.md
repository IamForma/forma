---
name: run-protocol-engine
description: Run — changes the protocol engine's extension machinery (extensions.cjs, engine-to-protocol.cjs), moves/sorts files across project/extensions and the protocol clone (branch dev), verifies by check/test runs, commits in the protocol clone without push
model: claude-sonnet-5-5
tier: standard
effort: medium
tools: Read, Edit, Write, Grep, Glob, Bash(node .forma/extensions/extensions.cjs*), Bash(node .forma/protocol/scripts/engine-to-protocol.cjs*), Bash(node .claude/scripts/sync-engines.cjs*), Bash(node .forma/protocol/scripts/check-release.cjs*), Bash(git mv *), Bash(git diff *), Bash(git status *), Bash(git log *), Bash(git -C .forma/protocol add *), Bash(git -C .forma/protocol rm *), Bash(git -C .forma/protocol mv *), Bash(git -C .forma/protocol commit *), Bash(git -C .forma/protocol status*), Bash(git -C .forma/protocol diff *), Bash(git -C .forma/protocol log *), Bash(git -C .forma/protocol branch*), Bash(node .claude/scripts/engine-switch.cjs*), Bash(node .forma/protocol/bin/forma.cjs*), Bash(node .forma/verify/verify-install.cjs*), Bash(node .forma/protocol/scripts/engine-to-protocol.cjs*), Bash(node --test *), Bash(node .minimax/tests/*), Bash(node .minimax/scripts/*), Bash(node .claude/scripts/checks/support/gen-gemini-roles.cjs*)
---

# `run-protocol-engine`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A tooling card whose result is a changed engine script that syncs project extensions with the engine folders (`extensions.cjs`, `engine-to-protocol.cjs`, the forma skill template), or a re-sorting of extension files (profiles, scripts) between layers of `project/extensions/` and the protocol clone, closed by `extensions.cjs check` without drift, the engine check (`sync-engines --check`; a dormant engine is skipped), `check-release --traces`, and a commit in the protocol clone on branch `dev` (English message, no push).

## Takes / does not take

- **Takes:** «teach `extensions.cjs` to copy a `template/<engine>` folder, then `custom/<engine>` over it, `check` without drift»; «`engine-to-protocol.cjs` skips both folders and stops with a question on an unsorted new file»; «sort 5 profiles and 16 scripts into template/custom, remove the custom ones from the protocol core in a separate commit»; «`--apply <file> --add <file>` moves a new file into the template»; «add an engine to the dormant registry and to the `REBUILD` table of `engine-switch.cjs`, with the wake/sleep check».
- **Does not take:** «extend a graph builder in `.claude/scripts/`» (→ `run-protocol-script`); «edit wording of a role or skill markdown, copies in step» (→ `run-protocol-docs`); «run a finished script and report» (→ `run-script`); «apply a step over an explicit list» (→ `run-mechanical`).

## Boundary

Edit only the files the kit names. The choice template/custom per file is the card's/kit's decision, written in `## History`; an unlisted file is a stop, return to `Kit`. Commits only in `.forma/protocol` on branch `dev` (check `git -C .forma/protocol branch --show-current` first); English message with no Cyrillic (prohibition 18); never push, never amend published history, never touch another branch. No project traces in engine files (prohibition 16). Verify by facts: quote the last line of `extensions.cjs check`, the engine check (`sync-engines --check`; a dormant engine is skipped) and `check-release --traces`. A conflict reported by `engine-to-protocol.cjs` (both sides changed) is a stop. A second identical diagnosis (prohibition 14) is a stop.
