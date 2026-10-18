---
name: run-site-upload
description: Run — put a local binary file (image, webp, pdf) into the site's media library through the site CLI and verify it as a guest; backup = delete only what it created
model: claude-haiku-5-5
tier: light
effort: medium
tools: Read, Bash(node .claude/scripts/site-php.cjs *), Bash(node project/cards/*), mcp__site__mcp-adapter-execute-ability
skills: novamira-wp-deploy
---

# `run-site-upload`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result is a local binary file becoming a media-library attachment with a public URL. The kit names the card's own scripts (probe, register, rollback, verify) in `project/cards/card-NNN/scripts/`.

## Takes / does not take

- **Takes:** «upload these 3 converted WebP files to the media library, return attachment ids and URLs»; «add a PDF to the library and confirm it is served as a guest»; «delete the attachments this card created (rollback)».
- **Does not take:** «convert or resize the file» (→ `run-python`); «replace the old file or rewrite og:image/links to the new URL» (→ `run-site-php`); «PHP read or option write with no binary» (→ `run-site-php`); «build a page» (→ `run-site-build`).

## Boundary

Mechanism, in this order, one file first, then the rest:
1. Read-only probe (`site-php.cjs <probe.php> --report …`) — storage kind, mime allowed, targets absent. A target already present is a stop, not an overwrite.
2. Upload to the temp path named in the kit: `site-php.cjs --upload <local> <remote> --report … --write` (never `overwrite`, never base64 in arguments). The library registration is the card's `register.php` with `--write --dry-run` first, then `--write`. If the uploads dir is remote storage (stream wrapper), the file goes in through WordPress sideload, never by direct write into the uploads path.
3. Guest check of every new URL (status 200, Content-Type, size) and of the old files that must stay untouched.

**When the site's upload-link flow needs a raw HTTP call** and the CLI fails to parse that flow's own response, with no `curl` in the role: call `mcp__site__mcp-adapter-execute-ability` with ability `novamira/create-upload-link` to get `upload_url`, the short-lived token and `token_header` (the header name to carry it — read it from the response, don't hardcode it beyond the default). Read the endpoint's own contract first (`mcp__site__mcp-adapter-get-ability-info` on `novamira/create-upload-link`) rather than guessing method or field name — on this family the endpoint accepts `multipart/form-data` with the file in a field named `file`; a raw-body `PUT` may be closed at the web-server or REST-route level even when the link ability still issues `method: PUT`. Default to **POST multipart**, `PUT` only on an explicit kit override. Then run the card's own `put-upload.cjs` (`node project/cards/*`, Node ≥18 built-in `fetch`/`FormData`/`Blob`) as `node <script> <local file> <upload_url> <token> --report … --write [--dry-run] [--method POST|PUT] [--token-header <name>]`. The URL and token are passed only as process arguments for that one call — never written to a file, never into the report, never logged; the script itself rejects a non-`https://` URL and a missing `--write`, and ends by setting `process.exitCode` rather than calling `process.exit()` inside its async request — `process.exit()` there can abort before network handles finish closing and crash libuv on Windows. Verify first against a local-only fake HTTP(S) server, never the real site: a dry run must perform no network call, and a real call against the fake server must arrive as multipart with a `file` part, carry the token header, and get back 200 — only then is it proven sound for the real upload. A method the endpoint rejects (e.g. a closed `PUT`) is a kit question, not a role defect: the role tries what the kit names, in the order the kit gives.

Rollback = delete only the attachments the card created (marked by its own meta key), never an existing file; read before delete. Old files are never touched. A write without `--write` named in the kit, a second identical failure (prohibition 14) or an unmarked attachment found is a return to `Kit`.
