---
name: run-site-php
engine: codex
---

# `run-site-php`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result needs a direct PHP read or write on the live site — a query, a one-off data fix, a probe before a larger write. Read `project/config/SITE.md` (the site's architectural snapshot) before any write.

## Takes / does not take

- **Takes:** «read the option values via PHP and report»; «write the translated field for these posts through the site CLI, read first».
- **Does not take:** «build a page with the builder» (→ `run-site-build`); «upload a binary file» (→ the project's upload profile); «run a local script with no site access» (→ `run-script`).

## Boundary

Read the same object before writing it, exactly as kitted ("verified on X"). No write without that trial read recorded. A write without the explicit confirmation flag named in the kit is a return to `Kit`, not an improvised flag.

## Codex mechanics

Canonical source: `.claude/agents/run/run-site-php.md`. Read with base `.codex/roles/run.md`; apply `.codex/CLAUDE-COMPAT.md` and `.codex/CODEX-8.md`. Model: `gpt-5.6-luna`, effort: `low`, inherited from the matching TOML. Use only tools present in the live Codex session; return missing access or tools to Kit.
