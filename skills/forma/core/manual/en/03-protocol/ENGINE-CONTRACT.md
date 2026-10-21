# Engine Contract (ENGINE-CONTRACT)

This specification defines the contract between the shared Forma protocol core and an engine adapter (`.claude/`, `.agents/`, `.codex/`, etc.).
Every engine must systematically declare for each of the nine contracts whether it is held **by construction** (platform-enforced, hook-gated, or ledger-derived) or **by discipline** (maintained by agent awareness when the platform mechanism is physically unavailable).

---

## The Nine Engine Contracts

### 1. Root Rules (`root-rules`)
- **What it guarantees:** Sections 1–7 of `AGENTS.md` are the single source of truth for the protocol law. An engine adapter never duplicates §§1–7 in its own files.
- **Proof:** Native import (`@AGENTS.md`) or native reading; verified by `node .claude/scripts/sync-engines.cjs --check`.

### 2. Context Isolation (`isolation`)
- **What it guarantees:** Physical separation of agent contexts between `Intent`, `Spec`, `Kit`, `Run`, and `Core` to satisfy Prohibitions 1 (independent confirmation) and 7 (clean context). By default, tasks are dispatched to isolated subagents (in parallel waves when independent) unless the human explicitly commands single-session execution ("Действуй сам").
- **Proof:** Mode 2 (subagent execution via separate conversations) with gate in `new-card.cjs` preventing production card creation in degraded Mode 1 without isolation; recorded in `.state/capabilities.json`.

### 3. Role Delivery (`role-delivery`)
- **What it guarantees:** The main session runs as `Intent` and receives `intent.md` and `intent-session-start.md` before the first turn.
- **Proof:** Injection via platform session hooks (`SessionStart`, `PreInvocation` with structured `injectSteps`) or explicitly declared as discipline in §8 with decisive probe experiment facts.

### 4. Call Continuation (`call-continuation`)
- **What it guarantees:** Local execution slips of the same `Run` are continued by addressing the live conversation ID (`send_message`) with constraints only, rather than reassembling.
- **Proof:** Engine-native messaging to live conversation ID; verified by process/subagent listing (`manage_subagents list`) and fallback to variant B on failure.

### 5. Spend Line (§3, `spend-line`)
- **What it guarantees:** Every attempt line in card `## History` carries tokens, duration, cache-read, and call ID read directly from the platform's execution result, never invented or typed from memory.
- **Proof:** Raw execution journal (`calls.jsonl`) fed by `PostInvocation` hook, spend lines formatted by `spend-line.cjs`, verified 1:1 by `ledger-parity.cjs`.

### 6. Deletion Guard (§2, Prohibition 1, `deletion-guard`)
- **What it guarantees:** Destruction or movement of protected protocol files (`.claude/`, `.agents/`, `.codex/`, `.devtool/`, `.forma/`, `AGENTS.md`, `PROJECT.md`, `GOAL.md`) is blocked. Single-use unlock is permitted only via the human code phrase "Отключи сенсорику".
- **Proof:** `PreToolUse` hook running cross-platform `guard-delete.cjs` against data registry `protected-paths.json`; tested by `test-guard-delete.cjs`.

### 7. Board Protocol (§6–7, `board-protocol`)
- **What it guarantees:** Cards strictly conform to the 5 fields, kinds (`work`/`tooling`/`decision`), synchronized `status` and `assignee`, and stage/route lines in `## History`.
- **Proof:** Verified on every card by `node .forma/board/check-board.cjs <card>`.

### 8. Plumb (§2, `plumb`)
- **What it guarantees:** Independent measurement of sliced tasks against catalog roles returning `{choice, score, noul}` with fail-closed secret scrubbing.
- **Proof:** Built-in small model executor or external executor (`typesafe/jev-1.13`) via engine-agnostic `plumb-run.cjs`.

### 9. Preflight Verification (`preflight`)
- **What it guarantees:** The engine adapter's wiring (hooks, roles, permissions, capabilities) is systematically verifiable upon installation.
- **Proof:** Entry in `.forma/install-manifest.json`, verify profile `verify-profile.cjs`, and automated check via `node .forma/verify/verify-install.cjs`.
