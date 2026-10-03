---
name: run-site-build
description: Run — builds or updates site pages, templates, and content blocks through a live site-builder MCP ability
model: gemini-3.8-flash
tier: standard
effort: low
tools: Read, Grep, Glob, run_command(node .claude/scripts/site.cjs *)
skills: novamira-wp-deploy, novamira-wp-elementor, site-config
---

# `run-site-build` (Gemini Engine)

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result is a page, template, or content block, built or changed through a live site-builder ability (a block editor or page-builder connector) — not a bare PHP write.

## Boundary

Write only through the ability or CLI command named in the kit, never by a direct file edit on the site. The live connection or the needed ability is missing — return to `Kit`, not a workaround with a similar ability. Verify the rendered page, not only the API response that the write call returned.
