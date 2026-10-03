# Codex configuration changelog

## Later

- Replaced the unsupported generic `gpt-5.6` model in Intent, Spec, and Core with the host-supported `gpt-5.6-sol` at the same medium reasoning effort.
- Declared `.agents/skills/` as the native discovery path and mirrored Claude-canonical project skills into it; the parity test checks every mirrored file because this workspace denies creating directory junctions.

## Earlier

- Replaced condensed Codex role summaries with adapters to the complete canonical Claude role bodies.
- Added all six on-demand adapters and the mechanical extractor agent.
- Added the Claude-to-Codex tool, skill, MCP, and subagent translation contract.
- Mirrored the project Novamira Visual MCP and Claude startup-check classes.
- Kept all changes inside `.codex/`; no Claude, shared-law, board, or project-content file was changed by this alignment.
