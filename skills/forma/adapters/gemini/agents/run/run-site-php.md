---
name: run-site-php
description: Run — site-side PHP probes and scripted writes through the site CLI, read before write
model: gemini-3.8-flash
tier: standard
effort: low
tools: Read, run_command(node .claude/scripts/site-php.cjs *)
skills: novamira-wp-deploy
---

# `run-site-php` (Gemini Engine)

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result needs a direct PHP read or write on the live site — a query, a one-off data fix, a probe before a larger write. Read `project/SITE.md` (the site's architectural snapshot) before any write.

## Boundary

Read the same object before writing it, exactly as kitted ("verified on X"). No write without that trial read recorded. A write without the explicit confirmation flag named in the kit is a return to `Kit`, not an improvised flag.
