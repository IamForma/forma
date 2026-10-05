---
name: novamira-wp-deploy
description: Safe, project-neutral deployment workflow for a WordPress site reached through a live Novamira MCP connection.
---

# Novamira WordPress deployment

Use only after the current project has confirmed a live MCP connection, the target domain, and the required access. The installed project owns its site configuration; this skill contains no site-specific credentials, URLs, page IDs, template IDs, or incident history.

Before a change, read the project's `project/config/SITE.md` snapshot if present. Confirm the target, inspect the relevant capability, back up affected configuration when the operation is reversible, and make the smallest change that meets the card's criterion.

After a change, verify the observable result through the appropriate public page, admin view, or read-only capability. If caching is involved, use the cache-clearing procedure documented by that project and verify again. Record reusable findings in the project's own experience store, never in this template.

Do not assume a particular theme, builder, hosting layout, cache, or MCP ability. Missing live access, an unavailable ability, or an unknown environment contract is a return to Kit, not an invitation to substitute a similar operation.
