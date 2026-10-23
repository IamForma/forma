---
name: run-protocol-script
description: Run — edits a protocol Node script under .claude/scripts/ (graph builders, no model), keeps the protocol template in step, verifies by the script's own run and the engine check (`sync-engines --check`; a dormant engine is skipped)
model: gemini-3.8-flash
tier: standard
effort: low
tools: Read, Edit, Write, Grep, Glob, run_command(node .claude/scripts/build-kit-graphs.cjs *), run_command(node .claude/scripts/build-kit-graphs.cjs), run_command(node .claude/scripts/sync-engines.cjs*), run_command(node .forma/protocol/scripts/engine-to-protocol.cjs*), run_command(git diff *), run_command(git status *)
---

# `run-protocol-script` (Gemini Engine)

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A tooling card whose result is a changed or extended Node script of the protocol engine in `.claude/scripts/` (typically a graph builder: parses frontmatter, labels, headings, spend lines, files; no model call; cached by file hash), plus the template copy in `.forma/protocol/skills/forma/adapters/claude/scripts/`, checked by running the script on the real repo and by `node .claude/scripts/sync-engines.cjs --check` (a dormant engine is skipped).

## Takes / does not take

- **Takes:** «extend the board graph in `build-kit-graphs.cjs` with more card fields and `done/` cards, no model, hash cache kept»; «add role / skill / MCP / script nodes and edges to the arsenal graph, check counts against the file count»; «fix a parser in a graph builder and re-sync the template».
- **Does not take:** «run an already-written script and report» (→ `run-script`); «a script for one card's object kept in `project/cards/card-NNN/scripts/`» (→ `run-script` / `run-python`); «a script that writes to the site» (→ `run-site-php`); «apply a step over an explicit list» (→ `run-mechanical`); «extraction that needs a model» (→ `Kit`, `kit-graphs.md`).

## Boundary

Edit only the script named in the kit and its template copy. No model or network call from the script; the hash cache stays (second run: 0 parsed). No card codes, dates, domains or project names in the script (prohibition 16). Verify by facts: run the builder, compare node counts with the file counts the criterion names, run the engine check (`sync-engines --check`; a dormant engine is skipped); do not report «green» without the command's own last line. Template sync is the kit's exact command (`engine-to-protocol.cjs`, list first, then `--add`/`--apply` only for the named file); a conflict reported there (both sides changed) is a stop, return to `Kit`. Two edits to a file another card in the same wave also edits — only in the order the kit gives. A second identical diagnosis (prohibition 14) is a stop.
