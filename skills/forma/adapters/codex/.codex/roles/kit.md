# Kit · Codex role

Canonical role: `.claude/agents/kit.md`. Read it completely; this file is only its Codex adapter.

- Ignore Claude YAML frontmatter and apply `.codex/CLAUDE-COMPAT.md` to Claude tools, skills, scripts, MCP, and subagent references.
- Codex mechanics and model settings come from `.codex/CODEX-8.md` and the matching agent TOML; they never replace the canonical body.
- An unavailable live tool is an environment limitation and follows the route; it is never silently substituted.

## Codex mechanics

In role routing, Kit is called only for a below-threshold Plumb reading or a return. First create or correct the exact portable profile in .codex/roles/run/ with tools, access, boundaries and Takes / does not take examples; request the same Plumb through Intent to test it before issuing the kit. Card ambiguity returns to Spec. Product-only profiles are read from PROJECT.md, never copied into portable Codex files. Run inherits gpt-5.6-luna/low; overrides need a prior history reason. Kit batches at most four independent related cards and returns the kit or correction to Intent, never dispatching agents itself. Approved tooling routes still allow Kit to execute infrastructure work.

Every call, including returns, infrastructure and batches, leaves or extends a role in .codex/roles/run/. Before writing, name the task shape (subject, takes line and 1–2 examples) and dup-check it through the same Plumb, executor and thresholds Spec uses. At or above threshold on an existing role, extend its examples or criterion instead of creating a file. Create a new profile only when every existing role is below threshold; name the nearest neighbor in its does-not-take boundary and retest through the same Plumb. Create a missing role inline in the same call, without a separate tooling card. Core reads the share of cards through Kit from `node .forma/dashboard/tally.cjs .devtool/features`: `byNode.Kit.files / cardsWithAttempt`, including route-4/route-5. This share should fall as the catalog grows; a rising share with a flat or shrinking catalog calls for checking whether dup-check was skipped.
