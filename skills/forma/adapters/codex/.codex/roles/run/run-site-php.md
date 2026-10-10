---
name: run-site-php
description: Run — site-side PHP probes and scripted writes through the site CLI, read before write
engine: codex
---

# `run-site-php`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result needs a direct PHP read or write on the live site — a query, a one-off data fix, a probe before a larger write. Read `project/config/SITE.md` (the site's architectural snapshot) before any write.

## Boundary

Read the same object before writing it, exactly as kitted ("verified on X"). No write without that trial read recorded. A write without the explicit confirmation flag named in the kit is a return to `Kit`, not an improvised flag.


## Codex mechanics

Canonical source: `.claude/agents/run/run-site-php.md`. Native execution: `.codex/CLAUDE-COMPAT.md` and `.codex/CODEX-8.md`. Apply their field, tool, hook and channel mappings to engine-specific examples in the complete text above; they do not change the role's criteria or route. Bare role/procedure names resolve within `.codex/roles/`.
