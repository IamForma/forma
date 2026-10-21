@AGENTS.md

# 8. Engine architecture in {{ENGINE_NAME}}

The protocol itself is `AGENTS.md`, imported by the line above — sections 1–7, identical in every environment. This file adds only what is true of {{ENGINE_NAME}} and of no other engine according to the nine contracts of `ENGINE-CONTRACT.md`.

* **Root rules (Contract 1: constructive):** `AGENTS.md` (the import above). This file carries no copy of them — one source, never two. Editing the protocol means editing `AGENTS.md`; editing this file means changing something about {{ENGINE_NAME}} alone. Parity is verified via `node .claude/scripts/sync-engines.cjs --check`.
* **Zone of edits:** role files under `{{DIR}}/roles/` or `{{DIR}}/agents/`; no other engine edits this zone by hand.
* **MCP configuration:** `{{DIR}}/mcp_config.json`.
* **Shared skills:** `{{DIR}}/skills/`.

### Execution Modes and Isolation (Contract 2: constructive / discipline)

* Declare whether physical context isolation between `Intent`, `Spec`, `Kit`, `Run`, and `Core` is available.
* State if Mode 2 (subagents / teamwork) or Mode 1 (fallback) applies, and how degraded mode is gated.

### Continuation of the same `Run` (Contract 4: constructive / discipline)

* How local execution slips are continued (by live call ID or reassembly).

### The Plumb (Contract 8: constructive)

* Built-in executor and external executor (`typesafe/jev-1.13`) routing.

## Models per node

| Node | Model |
|---|---|
| `Intent` | {{MODEL_INTENT}} |
| `Spec` | {{MODEL_SPEC}} |
| `Kit` | {{MODEL_KIT}} |
| `Run` | {{MODEL_RUN}} |
| `Core` | {{MODEL_CORE}} |

## Spend fields (§3) (Contract 5: constructive / discipline)

* Declare how attempt tokens, duration, cache-read, and call ID are captured and verified against the ledger.

## Deletion guard (§1, §2) (Contract 6: constructive / discipline)

* Declare how file deletions are intercepted and how single-use unlock via «Отключи сенсорику» is handled.

## Main session = `Intent` (§1) (Contract 3: constructive / discipline)

* Declare how `intent.md` and `intent-session-start.md` are delivered to the main session.

## Preflight Verification (Contract 9: constructive)

* Declare profile file `{{DIR}}/verify-profile.cjs` registered in `.forma/install-manifest.json`.
