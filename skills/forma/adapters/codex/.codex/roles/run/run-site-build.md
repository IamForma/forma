---
name: run-site-build
engine: codex
---

# `run-site-build`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result is a page, template, or content block, built or changed through a live site-builder ability (a block editor or page-builder connector) — not a bare PHP write. Read `project/config/SITE.md` (the site's architectural snapshot) before any write.

## Takes / does not take

- **Takes:** «build the new section on the page through the page-builder ability»; «change a template's content block and verify the rendered page».
- **Does not take:** «a one-off data fix by PHP» (→ `run-site-php`); «replace a binary file» (→ the project's upload profile); «only check how the page looks» (→ `run-visual-check`).

## Boundary

Write only through the ability or CLI command named in the kit, never by a direct file edit on the site. The live connection or the needed ability is missing — return to `Kit`, not a workaround with a similar ability. Verify the rendered page, not only the API response that the write call returned.

## Codex mechanics

Canonical source: `.claude/agents/run/run-site-build.md`. Read with base `.codex/roles/run.md`; apply `.codex/CLAUDE-COMPAT.md` and `.codex/CODEX-8.md`. Model: `gpt-5.6-luna`, effort: `low`, inherited from the matching TOML. Use only tools present in the live Codex session; return missing access or tools to Kit.
