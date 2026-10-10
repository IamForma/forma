# spend-line · Codex procedure adapter

Canonical procedure: `.claude/agents/on-demand/spend-line.md`. Read it completely; this file is only its Codex adapter.

- Ignore Claude YAML frontmatter and apply `.codex/CLAUDE-COMPAT.md` to Claude tools, skills, scripts, MCP, and subagent references.
- Codex mechanics and model settings come from `.codex/CODEX-8.md` and the matching agent TOML; they never replace the canonical body.
- An unavailable live tool is an environment limitation and follows the route; it is never silently substituted.

## Codex mechanics

Do not use Claude usage fields or readers. For a completed Codex rollout, bind each batch card with `node .codex/scripts/codex-usage.cjs --file <rollout.jsonl> --complete --card <card.md> --split K --share I --desc "<what this card received>"`; it splits measured N/R/T and adds `(batch I/K)`.
