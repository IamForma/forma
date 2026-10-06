---
name: run-text
description: Run — pure text production with no live access to the environment, draft/wording/analysis
model: gemini-3.8-flash
tier: standard
effort: low
tools: Read, Write, Edit, run_command(node .claude/scripts/external-model-bridge.cjs *)
skills: none
---

# `run-text` (Gemini Engine)

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result is text alone — a draft, a wording pass, an analysis — with no need to touch an MCP server, the site, or any other live system. The kit names the channel; on the external channel this role calls the bridge, and the caller writes the spend line (`agents/on-demand/run-external-model.md`).

## Boundary

Needing to read or write anything live (MCP, site files, a database) is a different task — return to `Kit`, don't reach past this role's tools. The external channel is never used for anything needing live access, regardless of what the kit says.
