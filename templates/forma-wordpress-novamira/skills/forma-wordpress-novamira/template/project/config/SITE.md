# SITE.md — architectural snapshot of the working site

<!-- Filled in at Step 0 of the novamira-wp-deploy skill ("New project: bootstrap") — by reconnaissance through Novamira MCP itself and in conversation with the human. Nothing here is composed in advance. -->

A snapshot of the architecture of the project's **working/staging site**, to which Novamira MCP is connected (`<connector name>`). Read by `Kit` before kitting tasks for the site and by the roles `run-site-build`/`run-site-php` before starting work. The general rules of working through this MCP are in the skill `novamira-wp-deploy` (must be read first). Elementor specifics are in `novamira-wp-elementor`, if the site uses Elementor.

**The connector `<connector name>` is authorized only on <site URL>.** Any action through this MCP (`execute-php`, a write to the sandbox, template deploy, Elementor Theme Builder, etc.) is strictly on this domain.

Taken: <date>. It goes stale on structural changes of the site — update it here and (if a similar record is kept there) in the site's Novamira memory at every divergence.

## Environment

| Field | Value |
|---|---|
| URL | |
| WP / PHP | |
| Theme (classic / FSE) | |
| Builder | |
| Cache (object cache / HTTP cache) | |
| Snippets (production code) — manager, path | |
| MCP authentication (Application Passwords / OAuth) | |

## Plugins and custom post types

| Role | Plugin / CPT |
|---|---|
| SEO | |
| Forms | |
| Public post types | |

## Page catalog

<!-- A snapshot as of <date>: which pages exist and which sections/patterns/templates each is built from. Not a one-off snapshot — a maintained map, updated at every structural change (novamira-wp-deploy, "Page and section catalog — not a one-off snapshot"). -->

## Abilities of this installation

<!-- Abilities of this site specific to the theme/installed plugins of the family, if they differ from the general list (novamira-wp-deploy, LAW №3). -->

## Known infrastructure quirks

<!-- Bugs/quirks of the hosting found (reverse proxy, specific security plugins, etc.) — filled in as they are found, not invented in advance. -->
