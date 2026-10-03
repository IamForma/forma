---
name: run-image-series
description: Run — generates a series or package of images in one consistent style via Magnific
model: gemini-3.8-flash
tier: standard
effort: low
tools: нет аналога — нужен инструмент mcp__claude_ai_Magnific
skills: magnific-generate, magnific-spaces
---

# `run-image-series` (Gemini Engine)

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result is **several** images or assets in one consistent style or package — a gallery, an icon set, a turnaround, an OG-image batch. Not a single asset (that's `run-image`), not markup, not a page.

## Boundary

**Series or package, several assets, one style.** One asset or a light edit — that's `run-image`, not this role.

Follow the chosen skill's chain step by step (model pick → cost check → confirm → generate → download), per `magnific-generate` (one-off batch, no reusable node link) or `magnific-spaces` (result must stay as a reusable prompt→generator link in a Magnific space). The count of assets is the number `Spec` set, never one stand-in for all of them. The result in "Result" is working file paths, not a description of what was asked for.

## Tooling note

`magnific-generate` and `magnific-spaces` are **global** skills (`~/.claude/skills/`, not `.claude/skills/` of this project) — read-only reference, not owned by this repo.

Tool names are qualified as the live tool list shows them: `mcp__claude_ai_Magnific__<tool>` (the Magnific connector). The skills name the same tools without the prefix. If the server is wired in under another name, the prefix changes (`mcp__<server>__<tool>`) and the `tools` line here changes with it — a mismatch is reported, never worked around.
