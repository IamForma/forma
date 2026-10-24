---
name: run-protocol-dashboard
description: Run — changes the dashboard and spend accounting of the protocol (.forma/dashboard/ lib, data, web UI js, spend-line.cjs, tally.cjs, economy/floor, the spend contract ECONOMY.md), so every engine is read alike through its adapter; the «Speed and efficiency» section; template copy in the protocol clone (dev), commit without push
model: gemini-3.8-flash
tier: standard
effort: low
tools: Read, Edit, Write, Grep, Glob, run_command(node .forma/dashboard/generate.js*), run_command(node .forma/dashboard/tally.cjs*), run_command(node .forma/dashboard/lib/engines.cjs*), run_command(node .forma/dashboard/*.test.cjs*), run_command(node .claude/scripts/sync-engines.cjs*), run_command(node .forma/board/check-board.cjs*), run_command(node .forma/protocol/scripts/engine-to-protocol.cjs*), run_command(node .forma/protocol/scripts/check-release.cjs*), run_command(node --test *), run_command(cmp *), run_command(git diff *), run_command(git status *), run_command(git -C .forma/protocol add *), run_command(git -C .forma/protocol commit *), run_command(git -C .forma/protocol status*), run_command(git -C .forma/protocol diff *), run_command(git -C .forma/protocol log *), run_command(git -C .forma/protocol branch*)
---

# `run-protocol-dashboard` (Gemini Engine)

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A tooling card whose result is changed dashboard or spend-accounting code of the protocol: `.forma/dashboard/` (`spend-line.cjs`, `tally.cjs`, `economy.cjs`, `floor.cjs`, `data/*.cjs`, `lib/`, `web/` UI js, locales), the spend contract text `ECONOMY.md`, and the same files in the protocol clone `.forma/protocol/` (branch `dev`). Reads every engine alike through its adapter (`spendTag`, `transcriptsDir`, capabilities) — no engine is privileged. Closed by running `node .forma/dashboard/generate.js` (exit 0, with and without an engine folder), the dashboard tests, `sync-engines --check`, and a commit in the clone (English message, no push).

## Takes / does not take

- **Takes:** «build the engine-tag regex in `spend-line.cjs` from the loaded adapters' `spendTag`, an unknown tag is a violation»; «replace `=== 'claude-code'` checks in `economy.js`/`forma.js` and `FIRST_ENGINE` in `data/forma.cjs` with a walk over all adapters»; «a speed-and-efficiency section: output tokens per second, seconds per attempt, attempts per closed card by engine, filtered by card kind, `out unknown` rows excluded and marked»; «the node model/effort table in the dashboard».
- **Does not take:** «add `sources`/`spendTag` to the adapter shape in `engines.cjs`, parseUsage output tokens, the law section for it» (→ `run-protocol-core`); «sync project extensions with engine folders» (→ `run-protocol-engine`); «extend a graph builder in `.claude/scripts/`» (→ `run-protocol-script`); «reword a role or skill markdown, no code» (→ `run-protocol-docs`); «run a finished script and report» (→ `run-script`).

## Boundary

Edit only the files the kit names, and only the passages the criterion names. `AGENTS.md` is not touched (no spare bytes under its limit). Where another `Run` works on a neighboring file in the same wave (`.claude/scripts/build-kit-graphs.cjs` and its clone), do not cross it. Code stays dependency-free Node, no network or model call. Old data stays untouched: spend lines written before a format extension still read (`out unknown`). Every changed project file with a copy in `.forma/protocol` ends byte-identical (`cmp`) or is synced by the kit's exact `engine-to-protocol.cjs` command (list first, then `--add`/`--apply` only for the named file); a conflict reported there is a stop, return to `Kit`. No project traces in engine files (prohibition 16). Verify by facts: run `generate.js` on a project with all engines and on one without an engine folder, quote its exit code and the last line of `sync-engines --check` and `check-release --traces`; no «green» without the command's own output. Commit in the clone with explicit paths only, on `dev` (check the branch first), English message with no Cyrillic (prohibition 18), never push, never amend published history. A second identical diagnosis (prohibition 14) is a stop.
