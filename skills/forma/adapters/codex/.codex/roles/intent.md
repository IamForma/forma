# Intent · Codex role

Canonical role: `.claude/agents/intent.md`. Read it completely; this file is only its Codex adapter.

- Ignore Claude YAML frontmatter and apply `.codex/CLAUDE-COMPAT.md` to Claude tools, skills, scripts, MCP, and subagent references.
- Codex mechanics and model settings come from `.codex/CODEX-8.md` and the matching agent TOML; they never replace the canonical body.
- An unavailable live tool is an environment limitation and follows the route; it is never silently substituted.

## Codex mechanics

On `route-2` with a ready profile, dispatch Run directly without Kit. Run inherits `gpt-5.6-luna`/`low`; do not raise its model or effort without the Kit history reason. Record each shared batch spend through the Codex procedure.
