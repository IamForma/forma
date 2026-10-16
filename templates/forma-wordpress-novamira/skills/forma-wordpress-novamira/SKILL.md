---
name: forma-wordpress-novamira
description: Puts into the current project this template's route (project/config/ROUTE.md — the reference for the fifth interview position) and an empty project/config/SITE.md stub — the architectural snapshot of the site Novamira MCP is connected to. The plugin's other skills (novamira-wp-deploy, novamira-wp-elementor) are already active on their own, this call is not needed for them. Call it when starting a new site project on this stack, or explicitly via /forma-wordpress-novamira.
---

# forma-wordpress-novamira — site project stub

Installs four things.

**The route** — `template/project/config/ROUTE.md` → `project/config/ROUTE.md`. This is the main thing the project template gives: the sequence by which a site on this stack is brought to a result (interview → landing prompt → Aura → landing as the prototype of all pages → predefined sitemap → three versions of the mockup). The interview script comes with the core and is not duplicated here; **the template adds only a reference to the fifth position** — "naturalness", that is, the route.

**The `project/config/SITE.md` stub** — `template/project/config/SITE.md` → `project/config/SITE.md`, an empty skeleton of the site's architectural snapshot (theme, cache, builder, snippets, MCP authentication, page catalog). The site's product data lives only in `project/`, not in `.claude/skills/` (`AGENTS.md`, "Three layers of files"). Filled in by fact, by reconnaissance of the specific site — not at installation.

**Site and translation scripts** — `template/scripts/` → `.claude/scripts/`: a wrapper of the novamira CLI, uploading PHP to the site, the .po translation pipeline, and the block translation scripts (extract Russian strings, translate-blocks pipeline, apply by line / by JSON pointer / by comment, assemble and write a page).

**`Run` profiles of this stack** — `template/agents/run/` → `.claude/agents/run/`: `run-site-upload`, `run-schema-markup`, `run-image-audit`, `run-pillow-translate`. They arrive ready, so `Plumb` finds the role in the catalog at once and `Kit` is not called to write it again for each site project. They are not part of the protocol core: the core's own catalog stays platform-neutral.

## Installation order

1. **Check whether it is already installed.** If the project already has `project/config/SITE.md` or `project/config/ROUTE.md` with filled-in steps — do not overwrite silently: show the content, ask the human (replace, merge by hand, cancel). `ROUTE.md` above all: it may hold a "Passed" section, and that cannot be restored.
2. **Copy the route.** `template/project/config/ROUTE.md` → `project/config/ROUTE.md`.
   **The idea skeleton — if there is one.** If `template/project/brief/idea.md` exists → `project/brief/idea.md`. If the project already has a filled-in `idea.md` (sections other than those marked "not yet asked") — do not overwrite silently: show it, ask the human, as in step 1. If it has none of its own, the core's skeleton stays.
3. **Set the template status.** In `project/config/PROJECT.md`, the "Project template" block: name `forma-wordpress-novamira`, source — this template, status — `forming with the human` while the "Passed" section of `ROUTE.md` is empty. The status `verified ready` is set **only after the route has been walked to a result**, and it is set by the human, not by the installer.
4. **Copy the `project/config/SITE.md` stub.** `template/project/config/SITE.md` → `project/config/SITE.md` (do not overwrite if the file already exists and is filled in — see step 1).
5. **Copy the site and translation scripts.** `template/scripts/*` → `.claude/scripts/` (create the directory if missing): `site.cjs`, `site-php.cjs`, `report-extract.cjs`, `loco-pipeline.py`, `po_shift_check.py`, `tokenator_translator.py`. If a file with that name already exists — do not overwrite silently: show the difference, ask the human. The scripts take the site and keys only from the project's `.env`, by name (`SITE_SLUG`, `TOKENATOR_API_KEY`, optional `TOKENATOR_ENDP`) — add the missing names to `.env.example` without values.
5a. **Copy the `Run` profiles.** `template/agents/run/*.md` → `.claude/agents/run/` (create the directory if missing; a profile that already exists is not overwritten — show the difference and ask). Add each to `.claude/project-layer.txt` of the project (the template's files are not the core's, the transfer to the protocol must not offer them), and to the table «Профили Run проекта» in `PROJECT.md` if the project keeps one.
6. **Show the human what comes next.** The stub is empty — filling it in (URL, WP/PHP, theme, cache, snippet manager, MCP authentication method, page catalog) happens at Step 0 of the `novamira-wp-deploy` skill ("New project: bootstrap"), by reconnaissance through Novamira MCP itself and in conversation with the human — it is not invented in advance.

## What this skill does not do

- **does not declare the route verified** — the status `verified ready` is set by the human by the fact of what has been passed, installation sets `forming with the human`;
- **does not bring its own interview script** — there is one script and it comes with the core, the template puts only the fifth position's reference;
- does not invent the content of `project/config/SITE.md` — the skeleton is empty, filling it in is reconnaissance plus conversation with the human, not installation;
- does not connect the MCP servers themselves (Novamira/Aura/Magnific) — each project has its own (its own site, its own credentials), see the plugin's README, section "MCP servers of this stack";
- does not publish or commit anything by itself.
