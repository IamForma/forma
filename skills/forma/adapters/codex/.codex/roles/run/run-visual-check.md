---
name: run-visual-check
description: Run — compares a live page or screenshot against a reference or criterion, before/after
engine: codex
---

# `run-visual-check`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose criterion is a visual or structural comparison — before/after a change, a live page against a reference image or an a11y snapshot.

## Boundary

Confirm from the inspected snapshot or screenshot alone, never from memory of the code change. An interactive step (click, fill) blocked by the environment is a known limitation, not a defect to work around twice — leave that criterion item open for `Intent`'s check, named as such, not silently marked done.


## Codex mechanics

Canonical source: `.claude/agents/run/run-visual-check.md`. Native execution: `.codex/CLAUDE-COMPAT.md` and `.codex/CODEX-8.md`. Apply their field, tool, hook and channel mappings to engine-specific examples in the complete text above; they do not change the role's criteria or route. Bare role/procedure names resolve within `.codex/roles/`.
