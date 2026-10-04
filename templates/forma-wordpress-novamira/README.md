# Forma: WordPress development (Novamira)

An optional companion plugin to [Forma](../../README.md), kept in its `templates/` directory — WordPress development with Novamira MCP (+ Elementor), a ready set with Aura/Magnific included. Installed separately, on top of base `forma`, only if the work is of exactly this kind.

## What is inside

Three skills are active right after the plugin is installed — nothing to copy:

| Skill | What it is for |
|---|---|
| `novamira-wp-deploy` | safe work with WordPress through Novamira MCP — authentication, sandbox→production, cache, persistence |
| `novamira-wp-elementor` | building pages in Elementor through MCP — containers, widths, Theme Builder conditions |

The third — `forma-wordpress-novamira` — is not a ready recipe but an installer: it puts into the current project an empty `project/config/SITE.md` stub (the architectural snapshot of a specific site — its own for every project, so it cannot be one common file for everyone who installs this plugin; the site's product data lives only in `project/`).

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
| `skills/forma-wordpress-novamira/template/scripts/` | site and translation scripts → the project's `.claude/scripts/`: `site.cjs` (novamira CLI on `SITE_SLUG` from `.env`), `site-php.cjs` (a PHP file to the site via execute-php, a JSON report), `loco-pipeline.py` (translating the ru_RU.po of Loco plugins in one run), `tokenator_translator.py` (auto-translating .po through `TOKENATOR_API_KEY`), `po_shift_check.py` (finding shifted translations in .po). Keys and site — only from `.env` |

## Known limitations of version 0.0.1

- not verified by a live installation in a separate project;
- the skills hold only portable method. Facts, examples and incidents of a specific site are kept in `project/config/SITE.md` and in that project's experience, not in the template.
