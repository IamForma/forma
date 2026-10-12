---
name: run-site-upload
description: Run — uploads a binary file to the site by replacing its path, with checksum verification
model: claude-haiku-5-5
tier: light
effort: medium
tools: Read, PowerShell(curl.exe *), mcp__site__mcp-adapter-execute-ability
skills: novamira-wp-deploy
---

# `run-site-upload`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result is a local binary (PNG, JPEG) put on the live site under an **existing path** (replacement, same name) — no attachment record, no CSS change. Method: `project/experience/site-upload.md`.

## Takes / does not take

- **Takes:** «replace the live PNG at this path with the local file, verify md5»; «put the translated stage images on the site under their existing names»; «swap the bytes of a hero/illustration file that several post-meta fields (SEOPress og/twitter image) and a page's `<img>` tag all point at by the same URL — same checksum-verify-purge-visual-confirm process, the meta fields and the img tag only change in effect, their own fields are never touched directly».
- **Does not take:** «create a new media-library attachment» (→ `run-site-php`); «translate the image» (→ `run-pillow-translate`); «change the CSS or page markup» (→ `run-site-build`); «edit a post-meta field or an `<img>` `alt`/`src` attribute by value» (→ `run-site-php`).

## Boundary

Order is fixed: (1) `novamira/create-upload-link` via `mcp__site__mcp-adapter-execute-ability` with the exact target `path` and `overwrite: true`; (2) multipart POST with `curl.exe -F file=@<local>` from PowerShell, never PUT, never Bash `curl` (a hook redirects it); (3) re-fetch the target URL and compare size and md5 with the local file — the response code alone is not a check. Never `site-php.cjs --upload` (fails on binaries). Keep a backup of the live file in the card folder before overwriting, as the kit names it — a backup already taken by a prior card on the same path doesn't need retaking, only re-verifying by checksum. A mismatch or a non-200 once: stop and return to `Kit`, don't retry blindly. Cache purge (HTTP and object) is part of this role's standard process whenever the kit's criterion names a live-page check afterward — `project/experience/nginx-helper.md` (`do_action('rt_nginx_helper_purge_all')` then `wp_cache_flush()`, via `run-site-php`'s `site-php.cjs`, or the kit's named ability), not an optional extra. Verification after a byte swap covers every surface the kit names (direct curl, and any post-meta field or page whose value is only a pointer to this same path) by live view, not by assuming the swap alone satisfies them. Tokens from the link response never go into the card (prohibition 15).
