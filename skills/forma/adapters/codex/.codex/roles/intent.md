# Intent · Codex role

Canonical role: `.claude/agents/intent.md`. Read it completely; this file is only its Codex adapter.

- Ignore Claude YAML frontmatter and apply `.codex/CLAUDE-COMPAT.md` to Claude tools, skills, scripts, MCP, and subagent references.
- Codex mechanics and model settings come from `.codex/CODEX-8.md` and the matching agent TOML; they never replace the canonical body.
- An unavailable live tool is an environment limitation and follows the route; it is never silently substituted.

## Codex mechanics

Run Plumb on behalf of Spec (or Kit retesting a role): scrub with the shared script, dispatch the isolated Codex helper, return typed readings and measured call metadata to the requesting node. Spec decides and writes the Plumb line. Plumb is not a sixth node and never confirms work. A Plumb-confirmed route-2 (why: plumb) goes directly to Run after the required human approval; why: ready remains for an already complete card and kit. Run inherits gpt-5.6-luna/low; only a recorded Kit override changes it. Apply external-service cycle limits and fail-closed fallback from CODEX-8.md.
