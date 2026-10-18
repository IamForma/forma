# Forma: WordPress development (Novamira)

An optional companion plugin to [Forma](../../README.md), kept in its `templates/` directory — WordPress development with Novamira MCP (+ Elementor), a ready set with Aura/Magnific included. Installed separately, on top of base `forma`, only if the work is of exactly this kind.

## What is inside

Three skills are active right after the plugin is installed — nothing to copy:

| Skill | What it is for |
|---|---|
| `novamira-wp-deploy` | safe work with WordPress through Novamira MCP — authentication, sandbox→production, cache, persistence |
| `novamira-wp-elementor` | building pages in Elementor through MCP — containers, widths, Theme Builder conditions |

The third — `forma-wordpress-novamira` — is not a ready recipe but an installer: it puts into the current project an empty `project/config/SITE.md` stub (the architectural snapshot of a specific site — its own for every project, so it cannot be one common file for everyone who installs this plugin; the site's product data lives only in `project/`).

## Version and contents

The version lives in `.claude-plugin/plugin.json`; every change is a line in [CHANGELOG.md](CHANGELOG.md). The installer writes the installed version into the project (`project/config/PROJECT.md`, «Project template» → source: `forma-wordpress-novamira@<version>`), so a project always shows which template version it stands on. The block below is rebuilt from the real file tree by `scripts/template-push.cjs --apply` — never edited by hand.

<!-- inventory:start -->
Template version **0.0.1**, assembled against protocol **0.0.1**. History — [CHANGELOG.md](CHANGELOG.md).

### Skills (3)

| Skill | What it is for |
|---|---|
| `forma-wordpress-novamira` | Puts into the current project this template's route (project/config/ROUTE.md — the reference for the fifth interview position) and an empty project/config/SITE.md stub — the architectural snapshot of the site Novamira MCP is connected to. The plugin's other skills (novamira-wp-deploy, novamira-wp-elementor) are already active on their own, this call is not needed for them. Call it when starting a new site project on this stack, or explicitly via /forma-wordpress-novamira. |
| `novamira-wp-deploy` | Safe, project-neutral deployment workflow for a WordPress site reached through a live Novamira MCP connection. |
| `novamira-wp-elementor` | Project-neutral rules for working with Elementor through a live, project-configured MCP connection. |

### Scripts → `.claude/scripts/` (19)

| Script | What it does |
|---|---|
| `apply-comment-translations.cjs` | substitutes Russian dev-note HTML comments in <work-root>/*/out.html with their English translations from a {ru: en} map file. |
| `apply-json-pointer.cjs` | applies tr-*.json entries addressed by JSON pointer (address "<source>#/a/b/c") onto a local copy of the live JSON file, verifying the OLD (RU) value at each pointer b... |
| `apply-line-strings.cjs` | applies tr-*.json entries addressed by line number (address "<source>:<line>", 1-indexed) onto a local copy of a live text/PHP file, replacing the exact OLD (RU) subst... |
| `apply-shell-translation.cjs` | orchestrates the file-dependent part of a shell-translation rollout: for each file-type target in a map-shell.json (ability "file" or "line-php"), and for theme.json (... |
| `assemble-home-blocks.cjs` | concatenates <work-root>/{other-1,section-01..10,other-11}/out.html into the single core/html block's `content` attribute string, stripping the wp:html block delimiter... |
| `build-core-html-payload.cjs` | builds the single execute-php payload for a direct wp_update_post write onto two core/html template parts (human decision: bypass Gutenberg finalization, found to wipe... |
| `build-page-payload.cjs` | builds the single execute-php payload for one page's direct wp_update_post write, replacing the Gutenberg pending-batch/finalization path (found unreliable on an earli... |
| `copy-file-verified.cjs` | Copy one file byte-for-byte, verify by sha256, confirm the source is untouched, and check that every relative src="..." and url(...) reference in the copy resolves. |
| `extract-ru-strings.cjs` | Russian strings from a list of sources, each with its own exact address. |
| `loco-pipeline.py` | translating the ru_RU.po of plugins in wp-content/languages/loco/plugins/ in one run (the run-scripts contract). |
| `po_shift_check.py` | Finding shifted translations in .po (a translation sits not at its own string). |
| `report-extract.cjs` | pulls a string field out of a site-php.cjs report's return_value into a local file (backup, mirror). |
| `shot-page.cjs` | Screenshot a local page with headless Chrome at several widths and save the console log. |
| `site-php.cjs` | a PHP file to the site through the novamira CLI; only a summary to the console (the run-scripts contract). |
| `site.cjs` | node .claude/scripts/site.cjs <novamira arguments>  →  novamira --site <SITE_SLUG from .env> <arguments> A pass-through wrapper: the stdio and exit code of novamira ar... |
| `split-translations.cjs` | splits a tr-*.json file ([{source, address, text}]) by `source`, writing <work-root>/<folder-for-source>/tr.json as [{id, text}] for translate-blocks-pipeline.cjs apply. |
| `tokenator_translator.py` | Auto-translating .po (en → ru) through Tokenator (an OpenAI-compatible API). |
| `tokenize-spacing.cjs` | Replace bare px spacing literals with scale tokens in an HTML file, with a before/after report. |
| `translate-blocks-pipeline.cjs` | Конвейер перевода текстовых узлов блоков Gutenberg: пачка -> перевод -> подстановка. |

### `Run` profiles → `.claude/agents/run/` (6)

| Profile | What it does |
|---|---|
| `run-html-audit` | opens a local HTML page in the browser at desktop and mobile widths, runs the design detector and the audit, writes a report with screenshots; reads, never edits the page |
| `run-html-mockup` | edits a local HTML/CSS mockup file (design tokens, typography, layout, tone, performance, hardening) against a list criterion; local files only, no site access |
| `run-image-audit` | views an image's own pixel content directly (text baked into a cover/illustration) and reports what it shows |
| `run-pillow-translate` | translates text on a raster image with Pillow/OpenCV by a card's own script, local output only |
| `run-schema-markup` | write structured markup (JSON-LD / schema.org) into a local file from local snapshot data, validated by the card's validator script; no site access |
| `run-site-upload` | put a local binary file (image, webp, pdf) into the site's media library through the site CLI and verify it as a guest; backup = delete only what it created |

### Project config stubs → `project/config/` (2)

- `ROUTE.md`
- `SITE.md`

### Connector manifest (`mcp.json`)

| Connector | Type | Variables |
|---|---|---|
| `novamira` | http | — |
| `chrome-devtools` | stdio | — |

Names and types only — never values; the credentials stay in the project `.env` and the client connector settings.
<!-- inventory:end -->

**Not in this template on purpose:** the interview skills `grilling` and `forma-grill-with-ui` (the core's, not WordPress-specific). The core's own `Run` catalog stays platform-neutral; everything WordPress- or HTML-mockup-specific lives here.

## Installation

```
claude plugin marketplace add IamForma/forma   # if not added yet
claude plugin install forma-wordpress-novamira@forma
# in the project:
"deploy the project/config/SITE.md stub" (or /forma-wordpress-novamira)
```

**If Forma is installed as a git clone (way 1)** — the template already lies in `protocol/templates/forma-wordpress-novamira/`, the plugin is not needed. In the project's session:

```
copy the skills from protocol/templates/forma-wordpress-novamira/skills/ into .claude/skills/ (except forma-wordpress-novamira)
read protocol/templates/forma-wordpress-novamira/skills/forma-wordpress-novamira/SKILL.md and install the project template by it
```

## MCP servers of this stack

The plugin does not connect them itself — Claude Code has no way to install an external MCP server with someone else's credentials automatically, only to launch one already configured. Below is what usually has to be connected by hand, for a specific project:

| MCP | What for | How to connect |
|---|---|---|
| Novamira | The bridge into a specific site's WordPress — `execute-php`, files, content, Voxel/Elementor abilities | the Novamira plugin is installed on the site itself, the connector — `claude mcp add` (or `/mcp`) with the REST endpoint address and your own credentials (Application Password or OAuth, see `novamira-wp-deploy` LAW №1) — its own for every site |
| Aura | Image generation, site publishing | a claude.ai connector, connected in the account's connector settings |
| Magnific | Image/video/audio/3D generation | a claude.ai connector, connected in the account's connector settings |

## Structure

| Path | What it is responsible for |
|---|---|
| `.claude-plugin/plugin.json` | the manifest of this plugin |
| `skills/novamira-wp-deploy/SKILL.md` | rules for working with WordPress through Novamira MCP |
| `skills/novamira-wp-elementor/SKILL.md` | rules for building in Elementor through MCP |
| `skills/forma-wordpress-novamira/SKILL.md` | the installer — puts the `project/config/SITE.md` stub into the target project |
| `skills/forma-wordpress-novamira/template/project/config/SITE.md` | the stub itself: an empty skeleton of the site's architectural snapshot |
| `skills/forma-wordpress-novamira/template/scripts/` | site and translation scripts → the project's `.claude/scripts/`: `site.cjs` (novamira CLI on `SITE_SLUG` from `.env`), `site-php.cjs` (a PHP file to the site via execute-php, a JSON report), `loco-pipeline.py` (translating the ru_RU.po of Loco plugins in one run), `tokenator_translator.py` (auto-translating .po through `TOKENATOR_API_KEY`), `po_shift_check.py` (finding shifted translations in .po), `report-extract.cjs` (a string field from a `site-php.cjs` report into a local file inside `project/`), and the block translation scripts: `extract-ru-strings.cjs`, `translate-blocks-pipeline.cjs`, `split-translations.cjs`, `apply-line-strings.cjs`, `apply-json-pointer.cjs`, `apply-comment-translations.cjs`, `apply-shell-translation.cjs`, `assemble-home-blocks.cjs`, `build-core-html-payload.cjs`, `build-page-payload.cjs`. Keys and site — only from `.env` |
| `skills/forma-wordpress-novamira/template/agents/run/` | ready `Run` profiles of this stack → the project's `.claude/agents/run/`: `run-site-upload` (replace a binary file on the site with a checksum), `run-schema-markup` (JSON-LD / schema.org written into a local file from local data, validator-checked, no site access), `run-image-audit` (view an image's pixels and report text baked into it), `run-pillow-translate` (translate text on a raster image with Pillow/OpenCV by the card's script) |

## Known limitations

- not verified by a live installation in a separate project;
- the skills hold only portable method. Facts, examples and incidents of a specific site are kept in `project/config/SITE.md` and in that project's experience, not in the template.
