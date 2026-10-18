# Run · Codex role

Canonical role: `.claude/agents/run.md`. Read it completely; this file is only its Codex adapter.

- Ignore Claude YAML frontmatter and apply `.codex/CLAUDE-COMPAT.md` to Claude tools, skills, scripts, MCP, and subagent references.
- Codex mechanics and model settings come from `.codex/CODEX-8.md` and the matching agent TOML; they never replace the canonical body.
- An unavailable live tool is an environment limitation and follows the route; it is never silently substituted.

## Codex mechanics

Read the assigned profile, including Takes / does not take, before the form check. A task outside that boundary returns to Kit by address and expected scope even when Plumb confirmed it. run.md is the base, never a selectable catalog profile. The Plumb reading does not waive the form check or confirm the result. Run inherits gpt-5.6-luna/low; an override needs Kit's prior history reason.
