---
name: novamira-wp-elementor
description: Project-neutral rules for working with Elementor through a live, project-configured MCP connection.
---

# Novamira WordPress Elementor

Use this skill only when the current site's `project/config/SITE.md` confirms Elementor and a live MCP exposes the needed capability. Read the current schema before changing an element: controls, widget types, and storage formats vary by Elementor version, theme, and installed extensions.

Make changes through the capability assigned in the card. Do not hard-code page IDs, template IDs, CSS selectors, control names, plugin versions, or connector names from another installation. Keep custom CSS scoped to the element being changed and regenerate or clear caches only by the procedure verified for the current site.

Verify both saved data and rendered output. A successful API response alone is not sufficient: inspect the relevant page at the criterion's viewport and confirm that related templates, conditions, and responsive behavior have not regressed. If the environment lacks a required capability, return it through Kit.
