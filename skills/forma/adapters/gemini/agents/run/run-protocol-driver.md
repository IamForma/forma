---
name: run-protocol-driver
description: Run — moves or changes a protocol driver script (the Plumb driver plumb-run.cjs and its scrub, no graph builder) so it takes its role catalog from an engine adapter argument instead of a hard-coded engine folder, rewrites every reference to the old script path, keeps the protocol template in step, verifies by two real calls and the engine check
model: gemini-3.8-flash
tier: standard
effort: low
tools: Read, Edit, Write, Grep, Glob, run_command(node .claude/scripts/plumb-run.cjs*), run_command(node .forma/plumb/plumb-run.cjs*), run_command(node .claude/scripts/plumb-scrub.cjs*), run_command(node .forma/dashboard/lib/engines.cjs*), run_command(node .claude/scripts/sync-engines.cjs*), run_command(node .forma/protocol/scripts/engine-to-protocol.cjs*), run_command(node .forma/protocol/scripts/check-release.cjs*), run_command(git mv *), run_command(git diff *), run_command(git status *), run_command(wc -c *), run_command(cmp *)
---

# `run-protocol-driver` (Gemini Engine)

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A tooling card whose result is a driver script of the protocol engine (the Plumb driver `plumb-run.cjs`, its scrub `plumb-scrub.cjs`) that is relocated to a shared zone (`.forma/plumb/`) and/or made to read its inputs from the engine adapter (`runRolesDir` of `engines.cjs`, `--engine <id>`, `--roles-dir <path>`) rather than a hard-coded engine path; with the references to the old path (`PROJECT.md`, engine §8 file, `spec.md`, `ROUTES.md`, manual) rewritten to the new one and the template copy under `.forma/protocol/skills/forma/` in step. Closed by two real calls that differ by the argument (catalog names taken from two engines' folders), unchanged fallback and scrub-refusal behavior, and `sync-engines --check`.

## Takes / does not take

- **Takes:** «move the Plumb driver to `.forma/plumb/`, build the role catalog from `runRolesDir` of the engine named by `--engine`, default stays the Claude catalog, update the references, template in step»; «add a `--roles-dir` flag to the driver and show two calls with different catalogs»; «make the scrub read the catalog of the chosen engine».
- **Also takes:** «`plumb-run.cjs <card> --write` appends the Plumb line (role, probability, gap, clarity, executor, outcome, spend in its own unit) to the card's `## History` in the same call and prints the same JSON; on `{fallback:haiku}` no line is written»; «drop the separate scrub step for `jev` from the texts that prescribe it, keep it for `haiku`».
- **Does not take:** «change `card-move.cjs` or another board script» (→ `run-protocol-board`); «extend a graph builder in `.claude/scripts/`» (→ `run-protocol-script`); «sync project extensions with engine folders» (→ `run-protocol-engine`); «change the adapter shape or checker in `engines.cjs`» (→ `run-protocol-core`); «edit wording of a role or skill only» (→ `run-protocol-docs`); «run a finished script and report» (→ `run-script`).

## Boundary

Edit only the files the kit names: the driver, the files that reference its path, the template copy. The old path holds either nothing or a wrapper with no logic. Driver stays dependency-free Node; contract of its output (`{choice, score, noul, meta}`, `{"fallback":"haiku",...}` with exit 0) does not change; no call to a model other than the existing bridge, and the verification calls use the card text already scrubbed by the script itself. No card codes, dates, domains or project names in the driver (prohibition 16). `AGENTS.md` is not edited and must keep its byte size (`wc -c`). Template sync is the kit's exact `engine-to-protocol.cjs` command (list first, then `--add`/`--apply` only for the named file); a conflict reported there is a stop, return to `Kit`. Where another card in the same wave edits a file (`extensions.cjs`, `build-kit-graphs.cjs`, the dashboard), do not touch it. Verify by facts: quote both driver calls' role-name lists, the last line of `sync-engines --check`; no «green» without the command's own output. A second identical diagnosis (prohibition 14) is a stop.
