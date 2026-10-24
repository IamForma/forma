# 8. Engine architecture in MiniMax Code

> The law itself is `AGENTS.md` (§1–§7) — it is read natively, at every step, and is never copied here.
> What this file holds is only what is true of *this* engine: where the machinery lives, and which
> contract of `ENGINE-CONTRACT.md` is met by construction and which by discipline.
>
> The nine contracts are declared one by one below. A claim of "constructive" is a claim about
> the machine, and it is checked by a test that runs: `.minimax/tests/test-minimax-adapter.cjs`.
> A claim that cannot be proven is written as discipline, with the reason.

**Zone:** `.minimax/` — the dot-directory at the project root that the core finds by convention
(`.forma/dashboard/lib/engines.cjs`, `loadAdapters`). No wrapper file in the root: `AGENTS.md`
is the only source of §1–§7, and it is already in the context of every step.

---

## Root rules (Contract 1: constructive)

The runtime discovers `AGENTS.md` in the working directory and loads it as project instructions —
before the first reply, and again at every step. Nothing has to be written, wired or remembered
for the law to bind this engine. Verified: the law's text arrives in the session context.

**Where it lives:** `AGENTS.md` (root), shared with every engine. This file does not restate it.

## Isolation of nodes (Contract 2: constructive)

A node runs in a child session with its own context: `task` starts a fresh child, and a plugin
subagent is such a child with its own system prompt. The doer and the confirmer are therefore
different contexts by construction, not by agreement (prohibitions 1 and 7).

**Where it lives:** the engine's plugin package `miniapps/minimax-engine/` (installed into the
runtime profile under the name `minimax-engine`), the runtime's agent roster
(`~/.minimax/agents/.builtin`), and the child-session boundary of `task`/`task_append`.

**What is proven, and what is not — named exactly.** The roster holds **four builtin agents**
(`explore`, `mavis`, `verifier`, `worker`). The protocol's own node roles are registered by the
engine's plugin package as scoped subagents — `minimax-engine:spec`, `:kit`, `:run`, `:core`,
`:extractor`, `:plumb-haiku`, `:asset-describer-haiku` — each one a child session of its own, each
carrying the role file of this zone as its system prompt. The role files are **not copied**: the
package's `agents/*.md` are generated from `.minimax/agents/*.md` by
`.minimax/scripts/gen-plugin-agents.cjs`, and `gen-plugin-agents.cjs --check` fails when they
drift.

**The limit is named, not smoothed.** A session's agent roster is built when that session starts.
A session that started before the package was installed does not see the plugin's subagents: the
delegation returns `Unknown agent: minimax-engine:…`. That was observed in the session that
installed the package — and in the next session the delegation worked: `minimax-engine:spec` and
`minimax-engine:extractor` ran as child sessions of their own. The same binding holds for the
hook scripts: the runtime keeps them as a content-addressed snapshot
(`~/.minimax/v2/plugin-hook-cache/sha256-tree-v1-<hash>/`), and a session keeps the snapshot it
started with. So a change in the package reaches a running session only through a new session.

**Where the observation is kept:** `.minimax/.state/observed-runtime.json` — the session's own
witness (what was seen, when, in which session). The probe reads that witness and names it as the
proof; the observation itself is not derivable from files, and the probe says so.

**The asymmetry is deliberate and is named here.** The probe answers `isolation` by the roster
(a thing it can see) and answers `continuation` with `available: null` (a thing it cannot see:
continuation is a runtime behaviour, not a file). `null` means *not proven*, `false` means
*proven absent*, and `true` is written only where the proof is named.

**Limit named:** the isolation gate of the core (`.forma/board/new-card.cjs`) reads the
capabilities file of *one* path — `.agents/.state/capabilities.json`. For this engine the file
lives at `.minimax/.state/capabilities.json`; the core check has to learn the second path.
That is a card to the core, not a change in this zone.

## Continuation of the same `Run` (Contract 4: constructive in mechanism and in the record)

`task_append` continues a live child session by its identifier — the same call as `SendMessage`
in Claude Code. The mechanism is constructive: the child stays alive and the correction reaches
it.

The record of that call is constructive as well: the package's `SubagentStop` hook receives the
platform's own identifiers of the call (`agent_id`, `agent_type`) and writes them to the journal.
The identifier in the journal is therefore the platform's, not the node's account of it.

**Observed:** two calls of this engine's nodes (`Spec`, `Extractor`) left their platform
identifiers in `.minimax/.ledger/calls.jsonl` — `mvs_02e8c498…` and `mvs_58cb0744…` — and the
spend lines derived from those records carry the same identifiers.

**Continuation, observed live:** a finished child call was continued by
`task_append` on its own task id — the runtime answered `activated` (the child had gone idle,
so a new turn started under a new task id) and the child answered in the same context; the
session id did not change and its transcript grew from two steps to three. The witness of that
observation lives in `.minimax/.state/observed-runtime.json` (`observations.continuation`), and
the probe reads it: `.minimax/.state/capabilities.json` therefore says `continuation.available:
true` with the observation named, instead of the earlier `null`. The probe never asserts
`true` by default: without the witness it stays `null`.

**Snapshot against the full transcript.** The journal record is the snapshot at `SubagentStop`:
the call's transcript keeps being written after the hook fired, so the full transcript is
equal or larger. The spend line therefore takes its numbers from the FULL transcript, while the
journal keeps the snapshot it was written with; old journal records and old card lines are not
rewritten (prohibition 5). A continuation is a separate attempt and gets its own line: the
delta against what the card already holds for that call (`sync-ledger.cjs --derive-record … --
card NNN`).

**What the payload does not carry:** the token counts and the cache-read count. They enter the
journal as `null`, the derived line reads `unknown tokens (cache-read unknown)`, and that is the
honest word — a missing number is never a zero.

**Where it lives:** `.minimax/.ledger/calls.jsonl` (raw calls) → `.minimax/scripts/sync-ledger.cjs`
(derivation) → the card's `## History`.

**How it is proven:** the core check `.forma/board/checks/ledger-parity.cjs` finds the journal by
convention — `<adapter dir>/.ledger/calls.jsonl` — and compares it with the card. A platform call
that no card pays for is reported as an orphan: that is the check working, not the engine failing.

## The Plumb (Contract 8: constructive)

The Plumb is engine-neutral: the scrubber and the decision driver are shared scripts, and this
engine calls them as they are — `.claude/scripts/plumb-scrub.cjs` and `.forma/plumb/plumb-run.cjs`
(the OpenRouter Decisions API). Scrubbing stays fail-closed: a refusal falls back to the in-family
executor, and the reason is a line in the card's history (prohibition 17).

**Catalog:** the driver takes the catalog's path as an argument — `--engine minimax-code` reads the
`runRolesDir` of this engine's adapter (`.minimax/agents/run/`), `--roles-dir <path>` overrides it.
The limit named in the earlier revision — the driver lived in another engine's zone and measured
against *that* engine's catalog — is closed: the driver moved to `.forma/plumb/`
(`.claude/scripts/plumb-run.cjs` is a one-line wrapper), and the catalog is chosen by the caller,
not by the driver's folder.

## Spend fields (§3) (Contract 5: constructive)

The line is not typed by the node: the journal record is turned into the line by
`.minimax/scripts/sync-ledger.cjs` through the shared formatter `.forma/dashboard/spend-line.cjs`.
Unknown fields stay `unknown` — never zero. The engine tag of the line is `minimax:`.

The record is the platform's: the package's `SubagentStop` hook writes the call it saw — its
identifier, its node, its duration — into `.minimax/.ledger/calls.jsonl`, and the caller derives
the line from that record. The core's parity check therefore compares the platform's word with
the card's word, and a call nobody paid for is visible.

**What the platform does carry — and where it lives.** The hook's own payload has no token
fields, but the runtime's session transcript does: `messages.jsonl` carries a per-step
`usage: {input, output, cacheRead, cacheWrite}` and the model name. The package reads it
(`scripts/transcripts.cjs`): the session's directory name is the base64 of its `sessionId`, so
the transcript is found by the identifier the hook already has. The numbers in the journal are
therefore the platform's own count, and the normalised transcript is written to
`.minimax/.transcripts/` — that is what the dashboard reads for the window floor and the
per-model split.

**Observed:** three calls of this engine's nodes (`Spec`, `Extractor`, `Plumb`) carry real
numbers — 31 023, 16 091 and 21 961 tokens with 19 749, 14 592 and 32 458 cache-read — and the
dashboard's engine split shows the `minimax` column with 47 114 tokens and 34 341 cache-read
and **no unknown** left. Before the transcript reader existed, the same lines read
`unknown tokens (cache-read unknown)`: the numbers were there the whole time, one layer down.

**The limit that stays:** a call whose transcript cannot be found keeps `null` and reads
`unknown` — never zero.

**Limit named:** the shared formatter whitelists the engine tags `claude-code`, `codex`, `gemini`.
Until the core learns `minimax`, the board check `engine-tag` flags the line. Card to the core.

## Deletion guard (§1, §2) (Contract 6: constructive)

The engine's plugin package carries a `PreToolUse` hook: a destructive command that touches the
protected set is refused with `permissionDecision: "deny"`, and the reason names the way out.
The package's `scripts/hook.mjs` is the guard; the protected set is data, not a regular
expression — the hook reads `.forma/rules/protected-paths.json` from the core when that file
exists, and otherwise the package's own `scripts/protected-paths.json`.

**The phrase is a password, not a description.** `UserPromptSubmit` watches for the exact phrase
«Отключи сенсорику» and, when it arrives, writes a one-shot marker
`.minimax/hooks/.delete-unlock`. The next destructive call on a protected path consumes the marker
and passes; the one after it is refused again and needs the phrase anew. The marker lives in this
zone, so a phrase given in one project cannot unlock a deletion in another.

**The guard is silent where there is nothing to guard:** the hook recognises a protocol project by
`AGENTS.md` and the `.minimax/` zone, and does nothing in any other project — the package is
installed in the profile and serves every project of the machine.

**Observed:** in the live session the guard refused a deletion inside `.minimax/` and named the
way out — the refusal came from the hook, not from a rule the node followed. The `UserPromptSubmit`
branch (the phrase that lifts the refusal) was not observed live: the phrase is the human's, and
it was only exercised in the simulation.

**Limit named:** the protected set of the core is not yet a file — `.forma/rules/protected-paths.json`
does not exist in this project, so the package's own list stands in for it. Making it core data is
a card to the core.

## Main session = `Intent` (§1) (Contract 3: constructive — observed)

The engine's plugin package carries a `SessionStart` hook. Its output is the documented shape for
injecting context into the model at the start of a session —
`hookSpecificOutput.additionalContext` — and it names the two files the main session has to read
first: `.minimax/agents/intent.md` and `.minimax/agents/on-demand/intent-session-start.md`. The
shape is verified by running the hook (`node --check` and the event simulation in this zone's
test).

The delivery itself was **observed**: the text of the hook's output arrived in the session's
context as the session-start block, and the node read it. The witness is
`.minimax/.state/observed-runtime.json`; the probe reports `roleDelivery.available: true` with that
witness named as the proof.

The belt stays anyway, because a belt that costs one file read is cheap: this engine reads its
role file as the first action of the session — `.minimax/agents/intent.md`, plus
`.minimax/agents/on-demand/intent-session-start.md`.

## Preflight verification (Contract 9: constructive)

`.minimax/scripts/capabilities.cjs` probes the environment and writes
`.minimax/.state/capabilities.json`: isolation, continuation, hooks, role delivery, source of
usage. It writes only what can be shown: a field that is **proven absent** is `available: false`
with a reason, a field that **cannot be proven from the environment** is `available: null` with a
reason, and `true` appears only where the proof is named. The core's card-creation gate reads
that file before opening a production cycle (see the limit named under Contract 2).

---

## The board and the card path (Contract 7: constructive)

The board is the core's: `node .forma/board/new-card.cjs --kind protocol --title "…"` opens a card
in the format of the protocol, and `node .forma/board/check-board.cjs <card>` checks it. Neither
script knows about engines — the card's history, its zones and its spend lines are written in the
core's format, and this engine is the one that writes them.

**How it is proven:** the board's checks are the core's, and the card's lines are derived from this
engine's journal (see Contract 5), so a card of this engine is checked by the same rules as any
other.

**Limit named:** the engine tag of the spend line is `minimax:`, and the shared formatter's
whitelist of tags (`claude-code`, `codex`, `gemini`) does not yet know it. Until the core learns
the fourth tag, the check `engine-tag` flags this engine's lines. Card to the core.

## Models per node

One model for the whole engine (`minimax-m3.1-flash`): the runtime offers no per-role model
selection that the role frontmatter could name, so the difference between a node and a measurement
is expressed by the tool set of the role, not by the model behind it. Roles that measure rather
than act (`extractor`, `plumb`) carry the smallest tool set for that reason.

## Zone of edits

- `.minimax/` — this zone. The law, the other engine zones and the core are not edited here.
- `.forma/board/` — the core's card scripts: read and run, never edited.
- A change that belongs to the protocol as a whole (a shared module, a registry, a check) is
  written as a card in the epic "3. Project protocol" and carried to the protocol source —
  in this project the source (`.forma/protocol/`) is not present, so that fact is named in the
  card's `## Result`, not smoothed over.

**Where this zone still leans on another zone.** The mirrored roles name the shared scripts where
those scripts physically live — `.claude/scripts/plumb-scrub.cjs`, `.forma/plumb/plumb-run.cjs`,
`graph-query.cjs`, `resources.cjs`, `sync-engines.cjs` and the rest of that family. Those scripts
behave engine-neutrally, but they are not in this zone, and a path in another engine's directory
is a dependency, not ownership. The Plumb driver is no longer such a case: it moved into the core
(shared zone `.forma/plumb/`) and takes the catalog by `--engine minimax-code` (or `--roles-dir`).
What is *not* a dependency is the role of this
engine's own spend line: `.minimax/agents/on-demand/spend-line.md` is written by this zone, not
copied — it prescribes this engine's tag, journal and derivation script, and the zone's test
guards that (a `claude-code:` tag in this zone would be accepted by the core and silently counted
as another engine's attempt).

**What the generator remaps, and what it does not.** The generator moves the *write* targets of
the roles into this zone — `project/extensions/claude/` → `project/extensions/minimax/`,
`.claude/settings.local.json` → `.minimax/settings.local.json`, "puts it in `.claude/scripts/`" →
"puts it in `.minimax/scripts/`" — and moves the *engine tag* of a role into this zone's tag
(`on-demand/route-choice.md` prescribed `claude-code:`; it now prescribes `minimax:`). It does not
rewrite the *read* references to the shared script family, and it does not rewrite the
schema-editing scope of `on-demand/intent-housekeeping.md`, which still names every engine's role
directory: that statement is about the protocol source, and it stays canonical until the core
takes the decision (card to the core). The same goes for `on-demand/intent-session-start.md`,
which names the Claude installer's own settings — reading them is not writing into another zone.
The zone's test guards the one thing that would silently mis-count: no role of this zone may
prescribe another engine's tag.

## Verification of this zone

- `.minimax/tests/test-minimax-adapter.cjs` — the form of the adapter, the presence and content
  of this file, the parity of the roles with the canonical ones, the derivation of a spend line
  from a journal record, the contract of the plugin package (manifest, agents, hooks) and the
  cleanliness of the zone (prohibition 16).
- `.minimax/scripts/gen-roles.cjs --check` — the roles of this zone match the canonical ones.
- `.minimax/scripts/gen-plugin-agents.cjs --check` — the package's subagents match the roles of
  this zone, tool for tool and path for path.
- `.minimax/scripts/install-plugin.cjs --check` — the installed package in the runtime profile is
  byte for byte the package of this project.
- `node .forma/board/check-board.cjs <card>` — the card passes the board's checks.
