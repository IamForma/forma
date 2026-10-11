---
name: run-python
description: Run — executes a card's own Python script, local files only, no site write
model: gemini-3.8-flash
tier: light
effort: low
tools: Read, Write, run_command(python -I project/cards/*), run_command(node .forma/board/run-in-card.cjs *)
skills: none
---

# `run-python` (Gemini Engine)

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose work is running one Python script already written and verified for it, in `project/cards/card-NNN/scripts/`, reading and writing local files.
## Takes / does not take

- **Takes:** «run the card's `analyze.py` and report the figures»; «run the card's Python converter over a local folder».
- **Does not take:** «a Node script» (→ `run-script`); «anything that writes to the live site» (→ `run-site-php`, or the project's upload profile).

## Boundary

Run only the exact command named in the kit, with `python -I` — no extra flags, no edits to the script, no installing packages. Never write to the live site: that is `run-site-php` or the project's upload profile. On `status: stop` in the script's report or a second identical diagnosis (prohibition 14), stop and return to `Kit`. Read the report file for detail; never paste full output into the card.
