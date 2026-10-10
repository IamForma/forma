# Kit · Codex role

Canonical role: `.claude/agents/kit.md`. Read it completely; this file is only its Codex adapter.

- Ignore Claude YAML frontmatter and apply `.codex/CLAUDE-COMPAT.md` to Claude tools, skills, scripts, MCP, and subagent references.
- Codex mechanics and model settings come from `.codex/CODEX-8.md` and the matching agent TOML; they never replace the canonical body.
- An unavailable live tool is an environment limitation and follows the route; it is never silently substituted.

## Codex mechanics

Run inherits `gpt-5.6-luna`/`low` from its matching Codex TOML. A stronger model or effort needs a reason in the card history before dispatch. One Kit call may kit at most four related independent cards; after return, record each measured share with the Codex batch procedure.
