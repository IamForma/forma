---
name: run-protocol-testfix
description: Run — turns a group of red tests of the protocol clone (.forma/protocol, node --test) green: classifies each failure by evidence (stale oracle / code defect / environment), fixes code in the source (.claude/, .forma/) and carries it into the clone, updates an oracle only where the code is proven right, commit in the clone without push
model: gemini-3.8-flash
tier: standard
effort: medium
tools: Read, Edit, Write, Grep, Glob, run_command(node --test *), run_command(node .claude/scripts/sync-engines.cjs*), run_command(node .forma/protocol/scripts/engine-to-protocol.cjs*), run_command(node .forma/protocol/scripts/check-release.cjs*), run_command(node .forma/board/check-board.cjs*), run_command(cmp *), run_command(git diff *), run_command(git status *), run_command(git log *), run_command(git -C .forma/protocol add *), run_command(git -C .forma/protocol commit *), run_command(git -C .forma/protocol status*), run_command(git -C .forma/protocol diff *), run_command(git -C .forma/protocol log *), run_command(git -C .forma/protocol branch*)
---

# `run-protocol-testfix` (Gemini Engine)

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose subject is a named group of failing tests in `.forma/protocol/test/` (one test file or a listed set). Closed by: every failure classified by a fact (file, line, expected vs actual) as `stale oracle`, `code defect` or `environment`, written in «Result»; the group green under `npm test` in the clone (mask `test/**/*.test.cjs`, the same as `check-release`) with no test weakened, and `check-release` exit 0; red tests are named from the full failure list (`check-release` prints it), never from the output tail; `test/baseline.cjs` and `test/eval-start-context.cjs` are not tests and stay outside the criterion; `sync-engines --check` and `check-release --traces` quoted; an English commit in the clone on `dev`, no push.

## Takes / does not take

- **Takes:** «15 red tests of `test/checks-output.test.cjs`: classify each, fix code or the oracle by evidence»; «7 red tests of one spend test file go green»; «a test expects `22003` bytes, the file is `21998`: find out whether the oracle is stale, the code wrong or the environment differs (line endings, path)».
- **Does not take:** «add a new rule or a field to the core contract, with the law text» (→ `run-protocol-core`); «edit one engine's adapter or its per-engine test» (→ `run-protocol-adapters`); «sync extensions with engine folders» (→ `run-protocol-engine`); «extend a graph builder script» (→ `run-protocol-script`); «run a finished script and report» (→ `run-script`). The line: an existing red test to be made green is this role; a new contract is `run-protocol-core`.

## Boundary

Classify before editing; the evidence is a command output or a file line, never a guess. An oracle changes only where the classification proved the code right; a test is never skipped, loosened or deleted. A code defect is fixed in the source file, then carried into the clone with the kit's exact `engine-to-protocol.cjs` command (list first, then `--add`/`--apply` only for the named file); a conflict there is a stop, return to `Kit`. Every changed file with a clone copy ends byte-identical (`cmp`). Dependency-free Node, no network. Version fields in `plugin.json`/`package.json` stay untouched unless the kit says otherwise. No project traces in engine files (prohibition 16). Commit only in `.forma/protocol` on `dev` (check the branch first), English message with no Cyrillic (prohibition 18), never push or amend. Quote the group's `node --test` summary line. Second identical diagnosis (prohibition 14) is a stop.
