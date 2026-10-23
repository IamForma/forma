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
- **Proof:** Built-in small model executor or external executor (`typesafe/jev-1.14`) via engine-agnostic `plumb-run.cjs`.

### 9. Preflight Verification (`preflight`)
- **What it guarantees:** The engine adapter's wiring (hooks, roles, permissions, capabilities) is systematically verifiable upon installation.
- **Proof:** Entry in `.forma/install-manifest.json`, verify profile `verify-profile.cjs`, and automated check via `node .forma/verify/verify-install.cjs`.

---

## The Adapter Contract (`forma-adapter.cjs`)

An engine ships a folder named `.<engine>/` with a `forma-adapter.cjs` inside. The core (`.forma/dashboard/lib/engines.cjs`) finds it by that file name, reads sources, spend tag, capabilities, roles and the node-to-model table from it, and edits nothing in another engine's folder. Every field is optional; a missing field is `unknown` (or an empty list), never `0` and never a guess. Paths are relative to the project root, written with `/`.

| Field | Type | Meaning | When missing |
| --- | --- | --- | --- |
| `engine` | string | engine tag, e.g. `claude-code` | `unknown` |
| `id` | string | engine name for `check <engine>` | the folder name without the dot |
| `spendTag` | string | tag that opens the description of a spend line (AGENTS.md §3) | the value of `engine` |
| `sources` | object | where the engine keeps its material (below) | convention from the folder (`sourcesOf`) |
| `capabilities` | object | `{ subagents, sendMessage, hooks, mcp }`, each a boolean | mode «деградированный» |
| `nodeModels` | object | `{ Intent, Spec, Kit, Run, Core }`, each `{ model, effort }` strings | no table |
| `writeZones` | array of strings | the engine's own folder and the cards (`.devtool/features`) | the engine's own folder only |
| `parseUsage(step)` | function | one transcript step to `{ tokens_in, tokens_out, cache_read, cache_write }`; unknown is `null` | no transcript spend |
| `rolesDir`, `onDemandRolesDir`, `skillsDir`, `engineRulesFile`, `templateSkills`, `syncScript`, `usageRefresh`, `mcpConfigs`, `engineSettings`, `formaRoles`, `structure`, `toolUsage`, `instructionWeight`, `stepsFromCacheRead`, `transcriptsDir` | as in the header of `engines.cjs` | dashboard and economy data | `unknown` or empty |

**`sources`** — `rolesDir` (node roles), `onDemandRolesDir` (roles loaded on demand), `runRolesDir` (the `Run` role catalog), `scriptsDir`, `skillsDir`, `testsDir`, `packageManifest` (strings), `mcpConfigs` (list of strings). `sourcesOf(adapter)` returns what is declared; an adapter without `sources` gets the convention: `<folder>/agents`, `/agents/on-demand`, `/agents/run`, `/scripts`, `/skills`, `/tests`, `packageManifest: null`, `mcpConfigs: []`. A declared path is never replaced by the convention.

**`capabilities` and the mode.** `modeOf(adapter)` returns «полный» (full) when `subagents` is `true` and «деградированный» (degraded) otherwise, including an adapter that declares no capabilities. The degraded mode is the one AGENTS.md §2 describes: the engine says so first, keeps the stages apart by markers and checks on inspected facts only.

**Roles.** `Kit` creates a role in the `rolesDir` (and `runRolesDir`) of the engine that will execute it — never in another engine's folder. An engine writes only inside its own folder and the cards (`writeZones`); a divergence in another engine's folder is named as a fact, not fixed by hand.

**Spend.** `parseUsage` returns `tokens_out`. A spend line carries it as the segment `O out` after the cache-read and before the seconds: `N tokens (R cache-read), O out, T s, <call id>`. A line written before the segment existed reads as `out unknown` and stays as written.

### Checking an adapter

```
node .forma/dashboard/lib/engines.cjs check <engine>
```

`<engine>` is the `id`, the `engine` tag or the folder name. The command prints one line per contract item — `✓ item` passed, `✗ item — detail` failed — and a last line `<id>: passed N, failed M`. Items: the adapter matches the declared shape; a spend tag exists; every declared source exists; `capabilities` has the four booleans; the mode; `nodeModels` names the five nodes; `writeZones` stay inside the engine's folder and the cards; `rolesDir` is inside the engine's folder; `parseUsage` gives `tokens_out` for a step with output tokens. Exit code: `0` all passed, `1` at least one failed, `2` no such engine or a wrong call. The command writes nothing.

### Minimal adapter

```js
'use strict';
// .demo/forma-adapter.cjs
module.exports = {
  engine: 'demo-code',
  spendTag: 'demo-code',
  sources: {
    rolesDir: '.demo/agents',
    onDemandRolesDir: '.demo/agents/on-demand',
    runRolesDir: '.demo/agents/run',
    skillsDir: '.demo/skills',
  },
  capabilities: { subagents: true, sendMessage: false, hooks: true, mcp: false },
  nodeModels: {
    Intent: { model: 'demo-large', effort: 'medium' },
    Spec: { model: 'demo-large', effort: 'medium' },
    Kit: { model: 'demo-large', effort: 'medium' },
    Run: { model: 'demo-small', effort: 'low' },
    Core: { model: 'demo-large', effort: 'medium' },
  },
  writeZones: ['.demo', '.devtool/features'],
  parseUsage: (step) => ({
    tokens_in: step.in ?? null,
    tokens_out: step.out ?? null,
    cache_read: step.cached ?? null,
    cache_write: null,
  }),
};
```
