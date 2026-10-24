---
name: run-protocol-board
description: Run — changes the board scripts of the protocol (.forma/board/*.cjs: card-move.cjs flags and modes, new-card.cjs, check-board.cjs and its checks/, run-in-card.cjs) and the role/manual texts that describe how they are called, one call replacing several hand steps; verifies by a real call on a scratch card and the board check; template copy in step
model: minimax-m3.1-flash
tier: standard
effort: medium
tools: Read, Edit, Write, Grep, Glob, Bash(node .forma/board/*), Bash(node .forma/dashboard/tally.cjs*), Bash(node .claude/scripts/claude-economy.cjs*), Bash(node .claude/scripts/card-session-spend.cjs*), Bash(node .claude/scripts/sync-engines.cjs*), Bash(node .forma/protocol/scripts/engine-to-protocol.cjs*), Bash(node .forma/protocol/scripts/check-release.cjs*), Bash(node --test *), Bash(wc -c *), Bash(cmp *), Bash(git diff *), Bash(git status *)
---

# `run-protocol-board`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A tooling card whose result is changed board code: a flag or mode of `.forma/board/card-move.cjs` (a stage move that also writes a History line, a batch close), `new-card.cjs`, `check-board.cjs` with its `checks/`, `run-in-card.cjs`; plus the passages of role files, `card-and-board.md`, `spend-line.md` and the manual that describe the call and must now describe the new one, and the template copy under `.forma/protocol/skills/forma/`. Closed by a real call on a scratch copy of a card (before/after of the card file quoted), the unchanged behavior without the new flag, the board check on the result, and `sync-engines --check`.

## Takes / does not take

- **Takes:** «`card-move.cjs --agent-id <id>` reads N and R from the call transcript, `--tokens` stays as fallback, unknown id gives the `unknown` marker with a reason»; «`card-move.cjs --to accept --session-spend <NNN>` appends the Intent spend line in the same call»; «`card-move.cjs --to core-close 001 002 --note <reason>` writes the closing line and nulls `assignee` on each named card, an unknown number stops before any write»; «add a check to `checks/` for a malformed History line».
- **Does not take:** «change the dashboard, `tally.cjs`, `spend-line.cjs` or the spend contract» (→ `run-protocol-dashboard`); «the Plumb driver `plumb-run.cjs` and its scrub» (→ `run-protocol-driver`); «a graph builder in `.claude/scripts/`» (→ `run-protocol-script`); «adapter shape or `engines.cjs`» (→ `run-protocol-core`); «reword a role or skill with no board code change» (→ `run-protocol-docs`); «run a finished script and report» (→ `run-script`).

## Boundary

Edit only the board script the kit names and the passages the criterion names. Several cards chain on one file (`card-move.cjs`): work only the card in hand, never the next one's flag; the earlier card's behavior must still pass. Dependency-free Node, no network or model call. The line a flag writes follows `AGENTS.md` §3 exactly (`attempt,` not a bare number, the dash before the engine tag); the value comes from the call's own metadata or is `unknown` with a reason, never zero or estimated. Verification on a scratch copy of a card in the scratchpad or `project/cards/card-NNN/`, never on a live board card; a flag that writes to a card is first shown by dry output if the script has one. `AGENTS.md` is not edited and keeps its byte size (`wc -c`). Another card in the same wave edits `extensions.cjs`, the dashboard, `plumb-run.cjs` — do not touch them. Template sync is the kit's exact `engine-to-protocol.cjs` command (list first, then `--add`/`--apply` only for the named file); a conflict there is a stop, return to `Kit`. No card codes, dates, domains or project names in engine files (prohibition 16). Quote the real output: the changed card before/after, `check-board.cjs` result, last line of `sync-engines --check`; no «green» without it. A second identical diagnosis (prohibition 14) is a stop.
