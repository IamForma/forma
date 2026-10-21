@AGENTS.md

# 8. Engine architecture in Antigravity

The protocol itself is `AGENTS.md`, imported by the line above — sections 1–7, identical in every environment. This file adds only what is true of Antigravity and of no other engine. Nothing here overrides a rule above; it says where that rule's machinery lives according to the nine contracts of `ENGINE-CONTRACT.md`.

* **Root rules (Contract 1: constructive):** `AGENTS.md` (the import above). This file carries no copy of them — one source, never two. Editing the protocol means editing `AGENTS.md`; editing this file means changing something about Antigravity alone. Parity is verified via `node .claude/scripts/sync-engines.cjs --check`.
* **Zone of edits:** role files under `.agents/plugins/forma/agents/` are verified against the canonical specification; no other engine edits this zone by hand.
* **MCP configuration:** `.agents/mcp_config.json` and `.agents/plugins/forma/mcp_config.json`.
* **Plugin and node roles:** `.agents/plugins/forma/` (manifest `plugin.json` and agent prompts in `agents/`, including the "on-demand" layer `agents/on-demand/`) — this is the "role directory" that sections 1–7 refer to by bare filename (`kit.md`, `spec.md`, `intent-goal-opening.md` and so on). **Run's own catalog:** `.agents/plugins/forma/agents/run/*.md` — one profile per `Run` subject (`run-site-build`, `run-site-php`, `run-image`, `run-image-series`, `run-text`, `run-mechanical`, `run-script`, `run-python`, `run-vector`, `run-visual-check`, `run-schema-markup`); profiles of one product live in the project's own catalog and are listed in `PROJECT.md`, never in the clean zone (`.agents/`); `run.md` stays the base template, not a role.
* **Shared skills:** `.agents/skills/`.

### Execution Modes in Antigravity (Contract 2: constructive)

Antigravity operates in two distinct session modes depending on platform startup profile:

1. **Mode 2: Multi-Agent / Teamwork (`invoke_subagent` and `define_subagent` available)**
   * **Auto-Bootstrap routine:** The specialized node roles (`Spec`, `Kit`, `Run`, `Core`) are not pre-registered in the environment's default subagent list (which initially contains only `self` and `research`). When starting a cycle, `Intent` registers them on demand by calling `define_subagent` using the system prompts from `.agents/plugins/forma/agents/<node>.md`:
     - `Spec`: `model: gemini-3.8-flash`, write tools enabled;
     - `Kit`: `model: gemini-3.8-flash`, write tools enabled;
     - `Run`: `model: gemini-3.8-flash`, write tools enabled (base template in `agents/run.md`, specific task profiles registered on demand from `agents/run/*.md` per the wave matrix);
     - `Core`: `model: gemini-3.8-flash`, read-only tools;
     - `plumb-gemini`: `model: gemini-3.8-flash`, read-only tools, no project context, returns JSON only;
     - `extractor`: `model: gemini-3.8-flash`, read/write tools only — registered only when a graph build needs model extraction (`kit.md`, "Graphs");
     - `asset-describer`: `model: gemini-flash-lite`, read-only tools, no project context, returns JSON only.
   * **Execution:** Once defined, `Intent` dispatches tasks along the route using `invoke_subagent`. Each subagent executes in a strictly isolated context without parent memory. Prohibitions 1 (independent confirmation) and 7 (clean context) are physically guaranteed.

2. **Mode 1: Single-Agent Session / Fallback (`invoke_subagent` absent in toolbox)**
   * In a standard quick chat session where subagent tools are missing, physical context isolation between nodes is unavailable.
   * **Gated by construction:** `node .forma/board/new-card.cjs` reads `.agents/.state/capabilities.json` and actively refuses to create production cards when `isolation.available === false`. The loop cannot start in degraded mode without an explicit override. The way out is enabling Teamwork mode (`/teamwork-preview` or `/boost`).

### Continuation of the same `Run` (Contract 4: constructive)

In Mode 2, Antigravity provides a native mechanism to continue a subagent:
* **Mechanism:** `send_message`, addressed to the live call's conversation ID (`Recipient: <conversationId>`). `Kit` sends the written correction there instead of invoking a new subagent.
* **How to verify the call is alive:** call `manage_subagents(Action: 'list')`. If the recorded `conversationId` is present with an active/receptive state (`idle`, `running`, `waiting_for_input`, `waiting_for_message`), the call is alive.
* **Hard gates (flips to B):** two conditions force variant B (reassemble, new subagent via `invoke_subagent`):
  1. No `conversationId` was recorded for that attempt in `.agents/.ledger/calls.jsonl`;
  2. The target is absent from `manage_subagents` list or reported in a terminal/error state (`errored`, `canceling`).
  Either gate means `send_message` has nothing to address; continuation is never retried as A.
* **Constraint:** the correction travels as plain text boundary ("align left, shadow mandatory"); nothing else about the subagent (tools, model, role prompt) changes underneath it — any change there is a kit change and forces B.
* **Mode 1 fallback:** in a single-agent session where subagent tools are absent, separate call IDs do not exist; continuation by call ID is unavailable, and only variant B (or degraded single-context continuation under §2) is permitted.

### The Plumb (Contract 8: constructive)

* **Built-in executor:** subagent on the small model (`.agents/plugins/forma/agents/plumb-gemini.md`: `gemini-3.8-flash`, read-only tools, no project context, returns JSON only).
* **Who calls it:** if `Spec` runs in an isolated subagent without subagent-invocation capability, the main session (`Intent`) runs the Plumb for `Spec`: `Spec` returns the sliced cards, the main session cleans the task using the shared script (`node .claude/scripts/plumb-scrub.cjs <card>`), invokes the executor, and hands the reading back to `Spec` to decide and record. In Mode 1 (single-agent session), `Intent`/`Spec` runs the cleanup script and executes the reading directly.
* **Scrubbing:** fail-closed via `node .claude/scripts/plumb-scrub.cjs <card>`. Do not copy the script. On refusal or secret-like residue, the call is blocked from any external model and falls back to the in-family built-in executor (or stops to the human if unscrubbable secrets remain).
* **Fallback:** on any error, missing API key for an external executor, or scrubbing refusal, execution falls back immediately to the built-in Gemini executor. The fallback reason is recorded in the card's `## History`.
* **External executor:** configured in `PROJECT.md`, «Маршруты», called over HTTPS with key from `.env` using scrubbed output only; the external executor adds its own unit count before the dash in spend accounting. **Selector:** read `plumb: haiku | jev` from `PROJECT.md`; `haiku` resolves to the built-in `gemini-3.8-flash` executor. For `jev` execution is handled via `.agents/scripts/plumb-run.cjs` delegating to `.forma/plumb/plumb-run.cjs` (OpenRouter Decisions API `typesafe/jev-1.13`) with roles directory `.agents/plugins/forma/agents/run`.
* **Spend and history line:** the Plumb spend line is written by `Spec` (or by the caller on its behalf) with engine tag `gemini:`, e.g.:
  `` `Plumb`, YYYY-MM-DD: attempt, N tokens (R cache-read), T s, `<id>` — gemini: role <name>, N % (gap G, clarity C), <executor>, <fits / below threshold / returned>. ``

## Models per node

Which model each node runs on is an engine matter, not a rule of the protocol — the five pairs in §1 hold whoever executes them.

| Node | Model |
|---|---|
| `Intent` | `gemini-3.8-flash` (effort medium) |
| `Spec` | `gemini-3.8-flash` (effort low) |
| `Kit` | `gemini-3.8-flash` (effort low) |
| `Run` | `gemini-3.8-flash` (effort low) |
| `Core` | `gemini-3.8-flash` (effort low) |
| `plumb-gemini` | `gemini-3.8-flash` (effort low) |
| `extractor` | `gemini-3.8-flash` (effort low) |
| `asset-describer` | `gemini-flash-lite` (effort low) |

## Spend fields (§3) (Contract 5: constructive)

Spend reporting is held **by construction** via independent ledger recording:
* **Call Ledger:** The `PostInvocation` hook (`.agents/hooks/post-invocation.cjs`) captures every invocation from `transcript.jsonl` into `.agents/.ledger/calls.jsonl` with exact token counts (`input_tokens`, `output_tokens`, `cache_read_tokens`), timestamps, and `conversationId`.
* **Derived spend lines:** Attempt lines in `## History` are not written from agent memory; they are derived from the ledger via `.agents/scripts/sync-ledger.cjs` using `.forma/dashboard/spend-line.cjs`.
* **Parity guarantee:** The core board check `ledger-parity.cjs` (`node .forma/board/check-board.cjs`) enforces strict 1:1 parity between calls in `calls.jsonl` and attempt lines in cards.

**Line format on this engine (checked by `check-board.cjs`, `agent-id` and `engine-tag`):** `` `Node`, YYYY-MM-DD: attempt, N tokens (R cache-read), T s, `<id>` — gemini: <what was done>. ``

- **The engine tag `gemini:` opens the description after the dash** — always, on every attempt line, including lines of `Run` written from the shared session.
- **`<id>` is the call id exactly as returned by the platform ledger.**
- **Numbers are read from the ledger, not estimated.**

## Deletion guard (§1, §2) (Contract 6: constructive)

Deletion protection is held **by construction**:
* **Mechanism:** Antigravity `PreToolUse` hook (`.agents/hooks/guard-delete.cjs` registered in `.agents/hooks.json`) intercepts every `run_command` invocation.
* **Data-driven registry:** Path evaluation uses `.forma/rules/protected-paths.json` and the cross-platform module `.forma/rules/guard-delete.cjs`, protecting `.claude/`, `.agents/`, `.codex/`, `.devtool/`, `.forma/`, `AGENTS.md`, `PROJECT.md`, `GOAL.md`.
* **Single-use unlock:** The code phrase «Отключи сенсорику» is intercepted from user prompts by the `PreInvocation` hook (`.agents/hooks/unlock-delete.cjs`), creating marker `.forma/.delete-unlock` which is consumed on the very first allowed deletion.

## Main session = `Intent` (§1) (Contract 3: held by discipline)

The main Antigravity session runs as `Intent`: before its first reply it reads `intent.md` and `intent-session-start.md`.
* **Decisive experiment finding:** Plain stdout from lifecycle hooks does not reach the model's context window; Antigravity ignores non-JSON hook output. Content injection requires returning JSON with `{ "injectSteps": [ ... ] }` (`systemMessage` or `ephemeralMessage`) in `PreInvocation`.
* **Current status:** Because session-level instructions (`intent.md`) are project rules, they are loaded via `.agents/rules/session-start.md` and read by `Intent` at session start; full automatic context injection via `PreInvocation` is experimental and declared as **discipline** until native project-level `SessionStart` is standardized.

## Preflight Verification (Contract 9: constructive)

The installation and wiring of the Gemini adapter is verified **by construction**:
* Registered in `.forma/install-manifest.json` with profile `.agents/verify-profile.cjs` and expected hooks (`guard-delete.cjs`, `unlock-delete.cjs`, `post-invocation.cjs`).
* Verified by running `node .forma/verify/verify-install.cjs`.
