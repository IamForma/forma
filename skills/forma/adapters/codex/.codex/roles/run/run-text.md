---
name: run-text
engine: codex
---

# `run-text`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result is text alone — a draft, a wording pass, an analysis — with no need to touch an MCP server, the site, or any other live system. The kit names the channel; on the external channel this role calls the bridge, and the caller writes the spend line (`.codex/roles/on-demand/run-external-model.md`).

## Takes / does not take

- **Takes:** «draft the English wording for these five labels»; «write an analysis of the findings from the attached notes».
- **Does not take:** «write the wording into the site» (→ `run-site-php`); «run the extraction script» (→ `run-script`); «read a live page to base the text on» (live access → `Kit`).

## Boundary

Needing to read or write anything live (MCP, site files, a database) is a different task — return to `Kit`, don't reach past this role's tools. The external channel is never used for anything needing live access, regardless of what the kit says.

## Codex mechanics

Canonical source: `.claude/agents/run/run-text.md`. Read with base `.codex/roles/run.md`; apply `.codex/CLAUDE-COMPAT.md` and `.codex/CODEX-8.md`. Model: `gpt-5.6-luna`, effort: `low`, inherited from the matching TOML. Use only tools present in the live Codex session; return missing access or tools to Kit.
