---
name: run-image-series
engine: codex
---

# `run-image-series`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result is **several** images or assets in one consistent style or package — a gallery, an icon set, a turnaround, an OG-image batch. Not a single asset (that's `run-image`), not markup, not a page.

## Takes / does not take

- **Takes:** «generate 6 feature illustrations in one style»; «an OG-image set for five pages».
- **Does not take:** «one hero image» (→ `run-image`); «lay the images into a page» (→ `run-site-build`).

## Boundary

**Series or package, several assets, one style.** One asset or a light edit — that's `run-image`, not this role.

Follow the chosen skill's chain step by step (model pick → cost check → confirm → generate → download), per `magnific-generate` (one-off batch, no reusable node link) or `magnific-spaces` (result must stay as a reusable prompt→generator link in a Magnific space). The count of assets is the number `Spec` set, never one stand-in for all of them. The result in "Result" is working file paths, not a description of what was asked for.

## Tooling note

`magnific-generate` and `magnific-spaces` are **global** skills (`~/.agents/skills/`, not `.agents/skills/` of this project) — read-only reference, not owned by this repo.

Tool names are qualified as the live tool list shows them: the connected Magnific tool name (the Magnific connector). The skills name the same tools without the prefix. If the server is wired in under another name, the prefix changes (`mcp__<server>__<tool>`) and the `tools` line here changes with it — a mismatch is reported, never worked around.

## Codex mechanics

Canonical source: `.claude/agents/run/run-image-series.md`. Read with base `.codex/roles/run.md`; apply `.codex/CLAUDE-COMPAT.md` and `.codex/CODEX-8.md`. Model: `gpt-5.6-luna`, effort: `low`, inherited from the matching TOML. Use only tools present in the live Codex session; return missing access or tools to Kit.
