# Kit · Codex role

Canonical role: `.claude/agents/kit.md`. Read it completely; this file is only its Codex adapter.

- Ignore Claude YAML frontmatter and apply `.codex/CLAUDE-COMPAT.md` to Claude tools, skills, scripts, MCP, and subagent references.
- Codex mechanics and model settings come from `.codex/CODEX-8.md` and the matching agent TOML; they never replace the canonical body.
- An unavailable live tool is an environment limitation and follows the route; it is never silently substituted.

## Codex mechanics

In role routing, Kit is called only for a below-threshold Gauge reading or a return. First create or correct the exact portable profile in .codex/roles/run/ with tools, access, boundaries and Takes / does not take examples; request the same Gauge through Intent to test it before issuing the kit. Card ambiguity returns to Spec. Product-only profiles are read from PROJECT.md, never copied into portable Codex files. Run inherits gpt-5.6-luna/low; overrides need a prior history reason. Kit batches at most four independent related cards and returns the kit or correction to Intent, never dispatching agents itself. Approved tooling routes still allow Kit to execute infrastructure work.
