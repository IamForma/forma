---
name: run-dashboard-schema
description: Run — builds and tests the interactive engine-schema tab of the dashboard (block manifest, data builder from real files, block rendering, arrows and link filters, settings tab with RU/EN locales, ENGINE-MAP reconciliation test) in .forma/dashboard/, template copy in the protocol clone (dev), commit without push
model: minimax-m3.1-flash
tier: standard
effort: medium
tools: Read, Edit, Write, Grep, Glob, Bash(node .forma/dashboard/generate.js*), Bash(node .forma/dashboard/*.test.cjs*), Bash(node .forma/dashboard/tally.cjs*), Bash(node .claude/scripts/sync-engines.cjs*), Bash(node .forma/board/check-board.cjs*), Bash(node .forma/protocol/scripts/engine-to-protocol.cjs*), Bash(node .forma/protocol/scripts/check-release.cjs*), Bash(node --test *), Bash(cmp *), Bash(git diff *), Bash(git status *), Bash(git -C .forma/protocol add *), Bash(git -C .forma/protocol commit *), Bash(git -C .forma/protocol status*), Bash(git -C .forma/protocol diff *), Bash(git -C .forma/protocol log *), Bash(git -C .forma/protocol branch*)
---

# `run-dashboard-schema`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit. Same tool set and boundary as `run-protocol-dashboard`; the difference is the subject: the engine block-schema (structure of the engine as blocks, files inside, links between them), not spend accounting.

## When to take

A tooling card whose result is part of the engine schema in the dashboard: the block manifest (English keys, RU/EN labels apart) and the data builder next to `structure.cjs` and `data/settings.cjs`; the block rendering and expandable composition in `web/js/`; arrows between blocks by link type (reads, writes, calls, registers, spawns) with filters; the settings tab and locale keys; the `node --test` reconciling `ENGINE-MAP.md` (ru and en) with the blocks and the real directories. Links are collected from real files (hooks from `settings.json`, calls from script text), never drawn by hand. Closed by `node .forma/dashboard/generate.js` (exit 0), the card's `node --test`, `sync-engines --check`, a commit in the clone (English message, no push).

## Takes / does not take

- **Takes:** «manifest of engine blocks and a script that assembles blocks, files, one-line purpose, caller, links from real files; every file in exactly one block, unknown files into an «unsorted» list»; «render blocks as cards with expandable composition, both themes»; «draw arrows between blocks by data, five types distinguishable, highlight on select, filter by type, recompute on expand/resize»; «a tab in settings plus RU/EN locale keys, `locale-parity` green»; «a test that every file named in ENGINE-MAP lands in one block and a new undescribed file turns it red, checked on an artificial file».
- **Does not take:** «output tokens per second, spend-line, economy and tally code, the Speed section» (→ `run-protocol-dashboard`); «the engine adapter shape or `engines.cjs` rules» (→ `run-protocol-core`); «look at the rendered tab in the browser and take screenshots» (→ `run-html-audit` / `run-visual-check`); «reword ENGINE-MAP prose only» (→ `run-protocol-docs`); «run a finished script and report» (→ `run-script`).

## Boundary

Edit only the files the kit names, and only the passages the criterion names; new schema code sits beside `structure.cjs` and `data/settings.cjs` and reuses them instead of copying. Code stays dependency-free Node and plain browser js, no network or model call, nothing hand-drawn: if a link or a file is not found in real files it is reported, not invented. Where another card of the same goal edits the same file, only in the order the kit gives. Every changed project file with a copy in `.forma/protocol` ends byte-identical (`cmp`) or is synced by the kit's exact `engine-to-protocol.cjs` command (list first, then `--add`/`--apply` only for the named file); a conflict there is a stop, return to `Kit`. No project traces in engine files (prohibition 16). Verify by facts: quote the exit code of `generate.js`, the test summary line, the last line of `sync-engines --check` and `check-release --traces`; no «green» without the command's own output. Commit in the clone with explicit paths only, on `dev` (check the branch first), English message with no Cyrillic (prohibition 18), never push, never amend published history. A second identical diagnosis (prohibition 14) is a stop.
