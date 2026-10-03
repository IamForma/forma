# Building an engine adapter

For an engine without a ready adapter (Codex, Gemini): how to build your own, using Claude Code as the sample.

For protocol developers; not installed into projects. Sample paths are relative to this repository; `.codex/`, `.agents/`, `GEMINI.md` are paths inside an installed project.

## Core / adapter boundary

| Core — shared, never edited for one engine | Adapter — each engine's own |
|---|---|
| `skills/forma/core/AGENTS.md` (§1–7) | the §8 file (sample `skills/forma/adapters/claude/rules/claude-8.md`) |
| `skills/forma/core/manual/en/03-forma/ECONOMY.md` — the economy contract | roles (sample `skills/forma/adapters/claude/agents/`) |
| `skills/forma/core/dashboard/economy.cjs` — the one math | hooks (sample `skills/forma/adapters/claude/hooks/`) |
| `skills/forma/core/dashboard/spend-line.cjs` — writes the spend line | economy module (sample `skills/forma/adapters/claude/scripts/claude-economy.cjs`) |
| `skills/forma/core/board/` — card check and creation | conformance test (sample `skills/forma/adapters/claude/scripts/claude-economy.test.cjs`) |
| `skills/` — interview skills | |
| `dashboard/` | |

## Seven points to reconcile

| # | Question to the engine | Claude sample |
|---|---|---|
| 1 | How does the engine receive all of `AGENTS.md` at start — natively, or by an import in its §8 file? | `skills/forma/adapters/claude/rules/claude-8.md` (native reading; fallback hook `skills/forma/adapters/claude/hooks/load-engine-section.sh`) |
| 2 | Which fields of a call's return give N (tokens), R (cache-read), T (duration), the call id? Missing — `unknown`, never 0 | `skills/forma/adapters/claude/rules/claude-8.md`, field table |
| 3 | Where is the transcript of a call and of the main session, and where is R read when the return lacks it? | `skills/forma/adapters/claude/dashboard/subagent-transcript.cjs` |
| 4 | Where do the engine's field names become the canonical variables of `ECONOMY.md`, and which test proves it? | `skills/forma/adapters/claude/scripts/claude-economy.cjs`, `skills/forma/adapters/claude/scripts/claude-economy.test.cjs` |
| 5 | Where do the five nodes' roles live, and how is a separate agent invoked? No isolation — degraded mode, `AGENTS.md` §2 | `skills/forma/adapters/claude/agents/` |
| 6 | What holds the delete guard (§1), the card check on write, delivery of `intent.md` at session start? | `skills/forma/adapters/claude/hooks/guard-delete.sh`, `skills/forma/adapters/claude/hooks/check-card.sh`, `skills/forma/adapters/claude/hooks/intent-start.sh` |
| 7 | How do the core interview skills (`skills/forma/core/skills/`) reach the engine — copy or reference? | `skills/forma/core/skills/` → `skills/forma/adapters/claude/skills/` by copy (checked by `checkClaudeDelivery` in `skills/forma/adapters/claude/scripts/sync-engines.cjs`) |

## "Ready" criterion

`node .claude/scripts/sync-engines.cjs --check`, list `ADAPTERS`:

- adapter found — its §8 file exists (`.codex/CODEX-8.md`, `.agents/rules/gemini-8.md`);
- `test: null` — info "not ready — no conformance test, not checked", not a breach;
- test path set, file missing — breach "no conformance test";
- test exists and fails — breach; passes — "conformance test passed" = **ready**.

The engine does not write its test path into `ADAPTERS` itself (the file is in Claude's zone) — it names the path to the human.

## Zone rule

An engine edits only its own: Codex — `.codex/`, Gemini — `.agents/` and `GEMINI.md`. The Claude sample is for comparison, not copying: assumptions about an unverified environment don't carry over. A divergence in another engine's zone is named to the human as a fact.
