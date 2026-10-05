# `Run` — External model

Read this file only when a card's kit assigns the **external channel** (the `external-model-bridge.cjs` bridge), not the Agent tool — not on an ordinary internal task. Shared rules — `.claude/agents/run.md`.

The execution channel is part of the kit, decided by `Kit`, not you: normally an attempt runs through the Agent tool (internal model), but for tasks that don't need live access to the environment (pure text — a draft, a wording pass, analysis with no MCP/file operations), `Kit` may assign the external model via the bridge (`Bash(node .claude/scripts/external-model-bridge.cjs *)`, DeepSeek/OpenRouter) — cheaper where reasoning over text needs no site access. You check the assigned channel in the card's kit; you don't choose it yourself or swap one for the other at your own discretion.

**An attempt through the bridge is also an attempt, and you write its line yourself** (`.forma/manual/en/03-forma/ECONOMY.md`, "External model and external service"; Claude Code's field mapping — `spend-line.md`). Normally the caller writes the line, but here there's no outside caller: the bridge calls `Bash` directly, not the Agent tool, so only whoever called it — you — can record it. Right after the bridge's response, without delay: take the numbers from the response itself (`cost_usd_estimate`, `duration_ms`, `usage.total_tokens`), never estimate by eye.
