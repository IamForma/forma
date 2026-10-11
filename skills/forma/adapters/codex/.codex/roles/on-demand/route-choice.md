# route-choice · Codex procedure adapter

Canonical procedure: `.claude/agents/on-demand/route-choice.md`. Read it completely; this file is only its Codex adapter.

- Ignore Claude YAML frontmatter and apply `.codex/CLAUDE-COMPAT.md` to Claude tools, skills, scripts, MCP, and subagent references.
- Codex mechanics and model settings come from `.codex/CODEX-8.md` and the matching agent TOML; they never replace the canonical body.
- An unavailable live tool is an environment limitation and follows the route; it is never silently substituted.

## Codex mechanics

A routine profile confirmed by the Gauge uses route-2 (why: gauge): Spec writes the six-unit kit and Intent dispatches Run directly after the required approval. Below fit thresholds → Kit, route-5 subject to enabled routes and approval; low clarity → Spec once. why: ready is reserved for an already complete card and kit. Run inherits gpt-5.6-luna/low; overrides need Kit's prior history reason. Gauge readings use the codex: tag and the actual executor name; see CODEX-8.md. Spec batches slicing; Kit batches at most four independent related cards.
