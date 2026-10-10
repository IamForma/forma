# route-choice · Codex procedure adapter

Canonical procedure: `.claude/agents/on-demand/route-choice.md`. Read it completely; this file is only its Codex adapter.

- Ignore Claude YAML frontmatter and apply `.codex/CLAUDE-COMPAT.md` to Claude tools, skills, scripts, MCP, and subagent references.
- Codex mechanics and model settings come from `.codex/CODEX-8.md` and the matching agent TOML; they never replace the canonical body.
- An unavailable live tool is an environment limitation and follows the route; it is never silently substituted.

## Codex mechanics

A ready routine profile uses `route-2` (`why: ready`): Spec writes its complete kit and Intent dispatches Run directly. Run inherits `gpt-5.6-luna`/`low`; a stronger model or effort needs Kit's prior history reason. Spec batches independent slicing without a cap; Kit batches at most four related independent cards.
