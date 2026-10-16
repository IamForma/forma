# run-image · Codex Run-profile adapter

Canonical role: `.claude/agents/run/run-image.md`. Read it completely with base `.codex/roles/run.md`; this file is only its Codex adapter.

- Ignore Claude YAML frontmatter and apply `.codex/CLAUDE-COMPAT.md` to Claude tools, skills, scripts, MCP, and subagent references.
- Codex mechanics and model settings come from `.codex/CODEX-8.md` and `.codex/agents/run-image.toml`; they never replace the canonical body.
- Use only tools present in the live Codex session. Missing access or tools return to Kit through the route.
