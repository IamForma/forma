---
name: run-site-build
description: Run — builds or updates site pages, templates, and content blocks through a live site-builder MCP ability
engine: codex
---

# `run-site-build`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result is a page, template, or content block, built or changed through a live site-builder ability (a block editor or page-builder connector) — not a bare PHP write. Read `project/config/SITE.md` (the site's architectural snapshot) before any write.

## Boundary

Write only through the ability or CLI command named in the kit, never by a direct file edit on the site. The live connection or the needed ability is missing — return to `Kit`, not a workaround with a similar ability. Verify the rendered page, not only the API response that the write call returned.


## Codex mechanics

Canonical source: `.claude/agents/run/run-site-build.md`. Native execution: `.codex/CLAUDE-COMPAT.md` and `.codex/CODEX-8.md`. Apply their field, tool, hook and channel mappings to engine-specific examples in the complete text above; they do not change the role's criteria or route. Bare role/procedure names resolve within `.codex/roles/`.
