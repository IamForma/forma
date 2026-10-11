---
name: run-python
engine: codex
---

# `run-python`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose work is running one Python script already written and verified for it, in `project/cards/card-NNN/scripts/`, reading and writing local files.
## Takes / does not take

- **Takes:** «run the card's `analyze.py` and report the figures»; «run the card's Python converter over a local folder».
- **Does not take:** «a Node script» (→ `run-script`); «anything that writes to the live site» (→ `run-site-php`, or the project's upload profile).

## Boundary

Run only the exact command named in the kit, with `python -I` — no extra flags, no edits to the script, no installing packages. Never write to the live site: that is `run-site-php` or the project's upload profile. On `status: stop` in the script's report or a second identical diagnosis (prohibition 14), stop and return to `Kit`. Read the report file for detail; never paste full output into the card.

## Codex mechanics

Canonical source: `.claude/agents/run/run-python.md`. Read with base `.codex/roles/run.md`; apply `.codex/CLAUDE-COMPAT.md` and `.codex/CODEX-8.md`. Model: `gpt-5.6-luna`, effort: `low`, inherited from the matching TOML. Use only tools present in the live Codex session; return missing access or tools to Kit.
