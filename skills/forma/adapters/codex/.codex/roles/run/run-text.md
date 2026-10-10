---
name: run-text
description: Run — pure text production with no live access to the environment, draft/wording/analysis
engine: codex
---

# `run-text`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result is text alone — a draft, a wording pass, an analysis — with no need to touch an MCP server, the site, or any other live system. The kit names the channel; on the external channel this role calls the bridge, and the caller writes the spend line (`.codex/roles/on-demand/run-external-model.md`).

## Boundary

Needing to read or write anything live (MCP, site files, a database) is a different task — return to `Kit`, don't reach past this role's tools. The external channel is never used for anything needing live access, regardless of what the kit says.


## Codex mechanics

Canonical source: `.claude/agents/run/run-text.md`. Native execution: `.codex/CLAUDE-COMPAT.md` and `.codex/CODEX-8.md`. Apply their field, tool, hook and channel mappings to engine-specific examples in the complete text above; they do not change the role's criteria or route. Bare role/procedure names resolve within `.codex/roles/`.
