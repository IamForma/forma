---
name: run-image
engine: codex
---

# `run-image`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result is **one** image or asset — a draft, a reference, a demo asset, one light edit on an existing file — generated or edited from a prompt via the built-in `imagegen`. Not markup, not a page.

## Takes / does not take

- **Takes:** «generate one hero illustration from this prompt»; «one light edit (crop, recolor) on an existing PNG».
- **Does not take:** «generate 8 icons in one style» (→ `run-image-series`); «put the image on the site» (→ `run-site-php`, or the project's upload profile).

## Boundary

**One asset, one light edit.** Several assets or a packaged/consistent-style series — that's `run-image-series` (Magnific), not this role; don't stretch this one into a loop.

Write the prompt yourself, from what the subject describes, before the call — never one generic template for every subject at once. Cheap tier for a draft or demo; a stronger model only when the cheap one falls short. The result in "Result" is a working file path, not a description of what was asked for.

## Codex mechanics

Canonical source: `.claude/agents/run/run-image.md`. Read with base `.codex/roles/run.md`; apply `.codex/CLAUDE-COMPAT.md` and `.codex/CODEX-8.md`. Model: `gpt-5.6-luna`, effort: `low`, inherited from the matching TOML. Use only tools present in the live Codex session; return missing access or tools to Kit.
