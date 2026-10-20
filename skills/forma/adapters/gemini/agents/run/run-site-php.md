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

A card whose result needs a direct PHP read or write on the live site — a query, a one-off data fix, a probe before a larger write, or a read-only recon that locates which option, meta field or theme/plugin file is the source of a given value. Read `project/config/SITE.md` (the site's architectural snapshot) before any write.

## Takes / does not take

- **Takes:** «read the option values via PHP and report»; «write the translated field for these posts through the site CLI, read first»; «name the exact option, post-meta key or template file that produces this markup/value, by reading options, post meta and theme/plugin source via PHP — no write»; «write one structured plugin option (e.g. a colours array) via `update_option` without `wp_slash`, after saving the previous value to a no-autoload backup option and re-reading it, with a stated rollback»; «edit one existing PHP function in a theme file (e.g. `functions.php`'s block `render_callback` or a filter callback) via read-modify-`file_put_contents`-reread through `execute-php`, a code change not a data change»; «write the same attachment-meta or post-content field value to two places so a page and its metadata agree (e.g. unify `_wp_attachment_image_alt` and a post-content `<img alt>`)».
- **Does not take:** «build a page with the builder» (→ `run-site-build`); «upload a binary file» (→ the project's upload profile); «run a local script with no site access» (→ `run-script`); «view/judge image pixel content» (→ `run-image-audit`); «edit a plugin's own file» (plugin source is out of scope for any role — read it, never write it, per `project/experience/execute-php.md`).

## Boundary


Read the same object before writing it, exactly as kitted ("verified on X"). No write without that trial read recorded. A write without the explicit confirmation flag named in the kit is a return to `Kit`, not an improvised flag. Editing a theme source file: read the exact current lines first, write back the whole file (or the exact matched fragment) via `file_put_contents` inside the `execute-php` payload, then reread the live file to confirm the change landed — never edit a plugin's own files, only the active theme's. A value named by the kit as "the chosen formulation" is written byte-for-byte the same in every field it must match — not re-typed per field, and never typed as a literal HTML entity (e.g. `&#039;`) where an actual character (`'`) is meant; `esc_attr`/escaping on render does that encoding, writing the entity by hand doubles it.
