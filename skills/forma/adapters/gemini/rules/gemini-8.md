@AGENTS.md

# 8. Engine architecture in Antigravity

The protocol itself is `AGENTS.md`, imported by the line above — sections 1–7, identical in every environment. This file adds only what is true of Antigravity and of no other engine. Nothing here overrides a rule above; it says where that rule's machinery lives.

* **Root rules:** `AGENTS.md` (the import above). This file carries no copy of them — one source, never two. Editing the protocol means editing `AGENTS.md`; editing this file means changing something about Antigravity alone. Housekeeping of both — `intent-housekeeping.md`; parity of the role files between engines is verified via `node .claude/scripts/sync-engines.cjs --check`.
* **Zone of edits:** role files under `.agents/plugins/forma/agents/` are carried over from Claude Code mechanically by `node .claude/scripts/sync-engines.cjs --apply` (Claude → Gemini: updated, and created when missing) — that carry-over is sanctioned; no other engine edits this zone by hand.
* **MCP configuration:** `.agents/mcp_config.json`.
* **Plugin and node roles:** `.agents/plugins/forma/` (manifest `plugin.json` and agent prompts in `agents/`, including the "on-demand" layer `agents/on-demand/`) — this is the "role directory" that sections 1–7 refer to by bare filename (`kit.md`, `spec.md`, `intent-goal-opening.md` and so on).
* **Shared skills:** `.agents/skills/`.

### Execution Modes in Antigravity

Antigravity operates in two distinct session modes depending on platform startup profile:

1. **Mode 2: Multi-Agent / Teamwork (`invoke_subagent` and `define_subagent` available)**
   * **Auto-Bootstrap routine:** The specialized node roles (`Spec`, `Kit`, `Run`, `Core`) are not pre-registered in the environment's default subagent list (which initially contains only `self` and `research`). When starting a cycle, `Intent` registers them on demand by calling `define_subagent` using the system prompts from `.agents/plugins/forma/agents/<node>.md`:
     - `Spec`: `model: gemini-3.8-flash`, write tools enabled;
     - `Kit`: `model: gemini-3.8-flash`, write tools enabled;
     - `Run`: `model: gemini-3.8-flash`, write tools enabled (base template in `agents/run.md`, specific task profiles registered on demand from `agents/run/*.md` per the wave matrix);
     - `Core`: `model: gemini-3.8-flash`, read-only tools;
     - `extractor`: `model: gemini-3.8-flash`, read/write tools only — registered only when a graph build needs model extraction (`kit.md`, "Graphs").
   * **Execution:** Once defined, `Intent` dispatches tasks along the route using `invoke_subagent`. Each subagent executes in a strictly isolated context without parent memory. Prohibitions 1 (independent confirmation) and 7 (clean context) are physically guaranteed.

2. **Mode 1: Single-Agent Session / Fallback (`invoke_subagent` absent in toolbox)**
   * In a standard quick chat session the subagent tools are missing, so physical context isolation between nodes is unavailable. **What to do then is the general rule of §2, "An engine with no way to invoke separate agents"** — tell the human first, keep the stages apart by explicit markers, check on inspected facts only, take only what a weak check can hold. It is not restated here.
   * **What is specific to this engine:** the absence is detected by `invoke_subagent` missing from the toolbox, and the way out is to activate Teamwork mode (`/teamwork-preview` or `/boost`) — so the node recommends exactly that when it reports the limitation.

### Continuation of the same `Run` (§2, "no direct return to `Run`, exception")

In Mode 2, Antigravity provides a native mechanism to continue a subagent:
* **Mechanism:** `send_message`, addressed to the live call's conversation ID (`Recipient: <conversationId>`). `Kit` sends the written correction there instead of invoking a new subagent.
* **How to verify the call is alive:** call `manage_subagents(Action: 'list')`. If the recorded `conversationId` is present with an active/receptive state (`idle`, `running`, `waiting_for_input`, `waiting_for_message`), the call is alive.
* **Hard gates (flips to B):** two conditions force variant B (reassemble, new subagent via `invoke_subagent`):
  1. No `conversationId` was recorded for that attempt;
  2. The target is absent from `manage_subagents` list or reported in a terminal/error state (`errored`, `canceling`).
  Either gate means `send_message` has nothing to address; continuation is never retried as A.
* **Constraint:** the correction travels as plain text boundary ("align left, shadow mandatory"); nothing else about the subagent (tools, model, role prompt) changes underneath it — any change there is a kit change and forces B.
* **Mode 1 fallback:** in a single-agent session where subagent tools are absent, separate call IDs do not exist; continuation by call ID is unavailable, and only variant B (or degraded single-context continuation under §2) is permitted.

## Models per node

Which model each node runs on is an engine matter, not a rule of the protocol — the five pairs in §1 hold whoever executes them.

| Node | Model |
|---|---|
| `Intent` | `gemini-3.8-flash` (effort low) |
| `Spec` | `gemini-3.8-flash` (effort low) |
| `Kit` | `gemini-3.8-flash` (effort low) |
| `Run` | `gemini-3.8-flash` (effort low) |
| `Core` | `gemini-3.8-flash` (effort low) |
| `extractor` | `gemini-3.8-flash` (effort low) |

## Spend fields (§3)

**Not established for this engine.** §3 requires three numbers per attempt — tokens, duration, cache-read — plus the call id, all read from the call's own result rather than estimated. Which fields of an `invoke_subagent` return carry them has not been verified here, and the Claude Code field names (`<usage>`, `subagent_tokens`, `duration_ms`, `cache_read_input_tokens`, `agent_id`) are **not** valid in Antigravity — they belong to a different API and were carried into this file by an earlier sync in error. Until a node establishes them by recon (`kit-recon.md`, epic "3. Form/Intent+Kit"), a caller on this engine writes the history line with the fields it can actually verify and names the missing ones as missing — it does not invent a number and does not silently drop the line: a missing cache-read or call id is written with the markers of `AGENTS.md` §3, row "Unknown" — `(cache-read unknown)`, `` `id unknown` `` — with the reason named after the dash. Establishing them is a `Kit` card, epic "3. Form/Intent+Kit".

**Line format on this engine (checked by `check-board.cjs`, `agent-id` and `engine-tag`):** `` `Node`, YYYY-MM-DD: attempt, N tokens (R cache-read), T s, `<id>` — gemini: <what was done>. ``

- **The engine tag `gemini:` opens the description after the dash** — always, on every attempt line, including lines of `Run` written from the shared session.
- **`<id>` is the call id exactly as the call returned it (hex, 8+ characters, or a UUID), or `` `id unknown` ``.** A slug or label of your own (`run-p4-exec`) is not an id and is never written in its place; with no verified id write `` `id unknown` `` and name the reason after the dash.
- **Numbers are read, not estimated.** A round figure the call did not return is an invention; an unread field takes its `unknown` marker (`(cache-read unknown)`, `unknown s`), never a guess.
- **An event that was not a call** (a stage, an approval) is written without `attempt` and without a spend block.

## Deletion guard (§1)

**Not established for this engine.** Claude Code blocks deletion of the protocol's own files with `.claude/hooks/guard-delete.sh`, Codex with `.codex/hooks/guard-delete.ps1`; no hook mechanism has been verified in Antigravity. Until one is, the protected set of `AGENTS.md` §1 holds by discipline, not by construction: a node deletes none of it without the human's phrase «Отключи сенсорику», one action per phrase. Establishing a hook is a `Kit` card, epic "3. Form/Intent+Kit".

## Main session = `Intent` (§1)

**Not established for this engine by construction.** The main Antigravity session is `Intent`: before its first reply it reads its role file `intent.md` and, at session start, the on-demand `intent-session-start.md`. No hook delivers them here, so it holds by discipline. **Recon:** Antigravity has hooks, but only user-level (`~/.gemini/config/hooks.json`, per-integration blocks) and with the events `PreInvocation`, `PostInvocation`, `Stop`, `PreToolUse`, `PostToolUse` — no `SessionStart`, no project-level file found, and whether a hook's stdout reaches the model's context is not established. A project protocol does not write into the human's global config, so nothing is wired. Reopen when a project-level hook file or a context-injecting session event is documented. Cards are created with `node .claude/scripts/new-card.cjs`.
