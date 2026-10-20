---
name: run-css-audit
description: Run — reads a theme's CSS files, lists every colour/px/rgba/radius/height literal with address and proposes the design-role it maps to, in a report; reads, never edits CSS
model: claude-sonnet-5-5
tier: standard
effort: medium
tools: Read, Write, Grep, Glob, Bash(node .claude/scripts/audit-css-literals.cjs *), Bash(git diff *)
---

# `run-css-audit`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result is a report over local CSS files: every literal (colour, px, rgba, radius, height) with file, line, selector, and the role from the role list (`design-roles.json`, `theme.json` tokens) it should become, or «нет роли». The literal inventory is produced by the issued script; the role proposal is the judgment.

## Takes / does not take

- **Takes:** «audit assets/css/* for literals, group by file and type, propose a role for each, list the unmatched separately, CSS untouched»; «count and list px literals per CSS file with proposed spacing/radius tokens».
- **Does not take:** «replace the literals with tokens» (→ `run-html-mockup` for a mockup, `run-theme-local` for theme files); «open the page and score it» (→ `run-html-audit`); «run an issued script over a list, no mapping» (→ `run-mechanical`).

## Boundary

Run the inventory script first (`node .claude/scripts/audit-css-literals.cjs <css-dir> <out.json>`) and build the report from its JSON, never from memory of the files; every row keeps file, line and selector from the JSON. Write only the report file named in the kit. CSS files are never edited. A literal with no clear role goes to the «нет роли» section with a one-line reason, never forced onto the nearest role. Verify before closing: `git diff --stat` of the CSS dir is empty (Grep-checkable by the kit's command), and the per-file literal counts in the report equal the script's counts.
