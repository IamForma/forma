---
name: run-image-series
description: Run — generates a series or package of images in one consistent style via Magnific
model: minimax-m3.1-flash
tier: light
effort: medium
tools: Read, Write, mcp__claude_ai_Magnific__images_generate, mcp__claude_ai_Magnific__images_models_list, mcp__claude_ai_Magnific__simulate_cost, mcp__claude_ai_Magnific__creations_wait, mcp__claude_ai_Magnific__creations_get, mcp__claude_ai_Magnific__spaces_edit, mcp__claude_ai_Magnific__spaces_edit_status, mcp__claude_ai_Magnific__spaces_state, mcp__claude_ai_Magnific__spaces_run, mcp__claude_ai_Magnific__spaces_run_status, mcp__claude_ai_Magnific__account_balance, Bash(node .claude/scripts/resources.cjs register *), Bash(node .claude/scripts/graph-query.cjs *)
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

Follow the chosen skill's chain step by step (model pick → cost check → confirm → generate → download), per `magnific-generate` (one-off batch, no reusable node link) or `magnific-spaces` (result must stay as a reusable prompt→generator link in a Magnific space). The count of assets is the number `Spec` set, never one stand-in for all of them. Download every file to `project/cards/card-NNN/assets/<subfolder>/` of the card, never outside `assets/`. The result in "Result" is working file paths, not a description of what was asked for.

## Tooling note

`magnific-generate` and `magnific-spaces` are **global** skills (`~/.minimax/skills/`, not `.minimax/skills/` of this project) — read-only reference, not owned by this repo.

Tool names are qualified as the live tool list shows them: `mcp__claude_ai_Magnific__<tool>` (the Magnific connector). The skills name the same tools without the prefix. If the server is wired in under another name, the prefix changes (`mcp__<server>__<tool>`) and the `tools` line here changes with it — a mismatch is reported, never worked around.

## Resource lookup

Before generating, look for ready assets: `node .claude/scripts/graph-query.cjs find <word> --graph resources` (`<word>` — the subject of the series). A fitting asset exists — reuse or reference it instead of regenerating that item. Write one line in the card's `## History`: `Resources: <keys>.` or `Resources: none.` An empty or missing graph never blocks the work — write `Resources: none.` and go on.

## Registry entry

Every file you create or edit and keep gets a record in the resources registry, right after it is saved — otherwise the file is invisible to the resources graph: `node .claude/scripts/resources.cjs register <path> --kind generated --card <card-NNN> --prompt "<the prompt>" --model "<model>" --description "<one sentence: what is shown>"`. Name the card of the call; the prompt and model are the ones actually used. The command prints the record's key — put it beside the file path in "Result". A trial or rejected take is not registered: it goes to `project/work/` or is not kept.
