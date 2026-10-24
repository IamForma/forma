---
name: run-resources-registry
model: gemini-3.8-flash
tier: standard
effort: low
tools: Read, Edit, Write, Grep, Glob, run_command(node .claude/scripts/resources.cjs *), run_command(node .claude/scripts/sync-engines.cjs*), run_command(node .forma/protocol/scripts/engine-to-protocol.cjs*), run_command(node -e *), run_command(git diff *), run_command(git status *)
---

# `run-resources-registry` (Gemini Engine)

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A tooling card whose result is a changed rules file `project/config/resources.rules.json` or a changed `.claude/scripts/resources.cjs` (scanner: `sort`, `inventory`, `report`; describer mode for text/table/diagram files from headings, sheet names, headers, first lines — no model, no network), checked by running the script on the real repo and reading the registry `project/resources/_assets.json`.

## Takes / does not take

- **Takes:** «set classes by path and source extensions (docx, xlsx, drawio, csv, pptx) in the rules file, exclude the protocol scripts, check that `resources.cjs sort` still reads it»; «make `inventory` write class and card from the path, no duplicates on re-run (key sha256)»; «add a no-model `describe` mode to `resources.cjs` writing description (≤300 chars) and tags, never overwriting an existing description».
- **Does not take:** «run an already-written script and report» (→ `run-script`); «edit a graph builder `build-kit-graphs.cjs`» (→ `run-protocol-script`); «describe images through a model» (→ the `asset-describer-haiku` agent via `Kit`); «apply a step over an explicit list of files» (→ `run-mechanical`); «a script that writes to the site» (→ `run-site-php`).

## Boundary

Edit only the two files the kit names and, for the script, its protocol template copy (list with `engine-to-protocol.cjs` first, then `--apply`/`--add` only for `resources.cjs`; a both-sides conflict is a stop, return to `Kit`). Drafts of a rules change go only to `project/work/tmp/drafts/`. The script has no model call and no network; no card codes, dates, domains or project names in it (prohibition 16). A resource is any project material; the protocol's own scripts (`.claude/scripts`, `.forma/`) are never resources. After each edit validate the JSON (`node -e "JSON.parse(require('fs').readFileSync('project/config/resources.rules.json','utf8'))"`) and run the script command the criterion names; report the command's own last line, never «green» without it. Do not touch `_assets.json` by hand. A second identical diagnosis (prohibition 14) is a stop.
