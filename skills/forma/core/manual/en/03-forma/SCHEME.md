# Structure of the Schema

> **Break down the intent so that the doer never has to guess.**
>
> *The same vagueness at the beginning costs a question, and at the end — a rework.*

What the schema is built from, what the environment must provide, how the cache and cycles are assembled. This file is for the human: **it is not fed to nodes** — they receive the project's `AGENTS.md` (the law of the protocol, §1–7) together with §8 of their engine, and their own role.

It is universal: not adjusted per work. Why — see `PROTOCOL.md`.

**Three layers.** The harness rests on three isolated environments, each with its own rule of change, yet they work together toward one goal:

| Layer | Contents | Changes | Essence |
|---|---|---|---|
| **Engine** | `AGENTS.md`, `.claude/rules/claude-8.md`, `.agents/rules/gemini-8.md`, `.forma/manual/`, `.claude/`, `.agents/`, `.forma/protocol/skills/forma/` | no (except the protocol version, `CHANGELOG.md`) | Rules and agents are the same for any project on this schema, not about a specific project |
| **Project** | `project/` entirely: `PROJECT.md`, `CONFIG.md`, `ROADMAP.md`, `VARS/`, `JOURNAL.md`, `goals/` | yes, as goals progress | The specifics of this project — what we work with, what we build, what is already decided |
| **Board** | `.devtool/features/` | yes, at every step of the cycle | The operational state — which task is where right now, who holds it |

`.forma/manual/` belongs to the **Engine** layer — the structure of the schema does not depend on which specific site is being built. The third layer is deliberately not named "intention": that name is already taken by the `Intent` node, and a layer name coinciding with a node name would be a source of confusion — the `Intent` node writes to all three layers (`GOAL.md` in the Project, cards on the Board, housekeeping in the Engine), rather than owning a separate layer. Diagram: `.forma/manual/en/assets/three-layers.excalidraw`.

| File | Layer | What it contains | Changes |
|---|---|---|---|
| `README.md` | Engine | entry point for the human: why the schema is structured this way | no |
| `.forma/manual/en/03-forma/SCHEME.md` | Engine | the structure of the schema — this file | no |
| `.forma/living/CHANGELOG.md` | Engine | protocol journal: what changed and what it fixes | with version |
| `.forma/protocol/skills/forma/SKILL.md` | Engine | installation procedure step by step | no |
| `.forma/protocol/skills/forma/template/AGENTS.md` | Engine | common rules (§1–7) — to all nodes, in any environment | no |
| `.forma/protocol/skills/forma/template/rules/claude-8.md` | Engine | Claude Code wrapper: import of `@AGENTS.md` + §8 of the engine | no |
| `.forma/protocol/skills/forma/templates-gemini/rules/gemini-8.md` | Engine | Antigravity wrapper: import of `@AGENTS.md` + §8 of the engine | no |
| `.forma/protocol/skills/forma/template/agents/` | Engine | what a node does — to that node alone | no |
| `.forma/protocol/skills/forma/template/` | Engine | the rest that gets installed: templates and hooks | no |
| `.forma/manual/en/03-forma/PROTOCOL.md` | Engine | justifications of the rules — does not travel into projects | no |
| `.forma/manual/en/03-forma/SKILLS.md` | Engine | registry of companion plugins (core + optional) — what each delivers, where the README is | new plugin |
| `.forma/manual/en/03-forma/ZONES.md` | Engine | five zones of the protocol constructor (numbering 1 Kit/2 Intent/3 Core/4 Spec/5 Run), what is mandatory and what is a replaceable part | new zone |
| `project/PROJECT.md` | Project | tooling, thresholds, accesses, project epic names, project language | per project |
| `project/CONFIG.md` | Project | project structure file by file + technical contracts of the environment + tooling log | as findings come in |
| `project/VALUE.md` | Project | statistics and value across closed goals — attempts, tokens, what the project gained | as goals progress |
| `project/ROADMAP.md` | Project | what we build and in what order | as goals progress |
| `project/VARS/` | Project | resolved values of the project, by entity files | as goals progress |
| `project/JOURNAL.md` | Project | records of closed cycles | upon closing |
| `goals/goal-NN/` | Project | a goal: a segment of the whole and its cycles | every goal |
| `.devtool/features/` | Board | a card is a file, the status column is the actual location/`status` field | at every step of the cycle |

**There is no separate arsenal file.** Which doers exist — the list of files in `.claude/agents/`; which skills — the folders in `.claude/skills/`; which tools — the MCP configuration. The inventory cannot diverge from reality, because it *is* the reality.

In the rest of the text, files are referenced by their short name: the names are unique, no need to add the folder.

---

## 1. Composition

Five nodes, five separate agents. **None of them has memory.** None confirms its own work by itself. The five nodes form **a single body of the Form (`forma`)**, protected by the emotional compass of five sentinel feelings (the awe of intent, the joy of simplicity, the naturalness of mastery, the disgust at substitution, the anger at the limit).

On this deployment, all five nodes run on one tier (`sonnet`) — the regulator is not the tier but the effort. The table holds the actual values of `.claude/agents/*.md`, not an example:

| Node | Code | Tier | Effort | Tool | Invoked |
|---|---|---|---|---|---|
| Intent | `Intent` | sonnet | extra high | `GOAL.md`, means of showing the image | opening, every task, closing |
| Specification | `Spec` | sonnet | high | task board | once per cycle |
| Kitting | `Kit` | sonnet | high | harness | once per cycle + on every return |
| Execution | `Run` | sonnet | medium | what `Kit` issued | every task |
| Center | `Core` | sonnet | extra high | `GOAL.md`, `JOURNAL.md`, numbers | upon a breached threshold |

`Core` (`core.md`, "Efficiency over time") diagnoses over-kitting — a criterion consistently passing on the first attempt at low effort — by lowering effort, not the tier: raising/lowering the tier only makes sense where more than one model is actually in use on the project.

**Two poles across this table:** `Intent`+`Spec` hold the form of the task (image, criterion, slicing), `Kit`+`Run` — the content (kit, action); `Core` is outside both. Why, and what happens at the moment of their joining — `PROTOCOL.md`, "The two poles and intention".

**Three regulators, independent of one another:**

| Regulator | Question | Set in |
|---|---|---|
| Tier | how much judgment | `model` in the agent's frontmatter |
| Effort | how expanded the judgment is | `effort` in the agent's frontmatter |
| Qualification | about what, and at what level | its own source for each node |

Qualification — a slice of the subject matter, its own for each node; the level is read in place from what stands before the node (the brief — for `Intent`, `ROADMAP.md`/`GOAL.md` — for `Spec`, its own search of the arsenal — for `Kit`, the card — for `Run`; `Core` is not varied), not a separate field filled in advance (`CLAUDE.md`, `PROJECT.md`). It sets a vector, not a method.

What each node works with, the human declares in `PROJECT.md`. `Kit` at the opening of a cycle **checks the declared against the arsenal and names the gap**, but does not choose tools for other nodes. **Only `Run` is kitted for a task** — tasks exist only for it.

Nodes on the same model remain distinct agents without shared context. A node's name does not depend on the model.

**The Form has no commands.** None at all — no helper node, no "tell me what to do now" call. What to do now is predetermined by the law and the state of the files, not a separate entry: conversation flows freely, but as soon as action begins — the route is the only one and the details are not chosen. The order of installation steps — `SETUP.md`, the short readiness summary at session start — the `check-ready.sh` hook.

---

## 2. Environment requirements

**What is fed to a node at invocation:** the cycle cache, the common rules (the project's `AGENTS.md` — arrives via the root file of its engine), its own role, the task. This file is not fed.

1. Every node invocation — an isolated context.
2. One-by-one checking — a separate invocation per task.
3. Routing of packets — without model involvement.
4. Counting attempts, returns, and spend — without model involvement.
5. The number of the current attempt is fed to the node as a number together with the task.
6. Issuing and re-issuing the cycle cache.
7. Feeding each node its role and the common rules.

The canon and the common rules are unchanged for the whole project: if the environment can hold several caches, they are cached per project, and only the variable part of the cycle is re-issued.

---

## 3. The cycle cache

Issued by the environment, its contents written by `Intent` at the opening, re-issued every cycle.

**Includes:** this file; `GOAL.md`; **`ROADMAP.md`**; **`VARS/` (the values files needed by this cycle)**; thresholds; accesses; formalized skills; **references** — project ones at the version fixed at the opening, and the references of this cycle.

The map is included in full: without it, `Intent` opens the fifth goal not knowing of the first four, and `Spec` slices what was done in the third. It changes only between cycles — like `GOAL.md` — and does not contradict the rule about the mutable.

Skill, reference, and data are different things:

| What | Answers the question | Where declared | In cache |
|---|---|---|---|
| Skill | how to do it | the skill in `.claude/skills/`; the list — the `SKILL.md` files themselves | in all cycles |
| Project reference | what to conform to | `PROJECT.md` | in all cycles |
| Goal reference | what to conform to in this segment | `GOAL.md` | in the cycles of this goal |
| **Value** | **what is already decided** | **`VARS/<entity>.md`** | **in all cycles** |
| Data | what to work with | the task card | arrives with the task |

A reference came from outside and is not discussed. A value is decided inside the work — it can be revisited, but only knowing who leaned on it: the `[[name]]` links and the "Leaning on it" column exist precisely for that. Changing a value is an event recorded in `JOURNAL.md`, not an edit.

A reference is placed **as a link and a version**, not by its content. A link to its point in a readiness criterion is part of the criterion, not a wish. Into the project reference goes what tasks of several cycles refer to; a one-time one — into the cycle reference.

**Never included:** card histories, named discrepancies, counters, `JOURNAL.md`, "What was missing".

---

## 4. Collapsing the schema

| Condition | Composition |
|---|---|
| One or two tasks | no schema: name a readiness criterion and do it |
| The end-image is obvious from the statement | without `Intent` at the opening |
| Fewer than ten tasks | `Intent`, `Kit`, `Run`; `Intent` takes the slicing, `Core` not needed |
| The norm | the five nodes |
| A very large batch | six: the checking is taken by `Check` (fast), `Intent` — only opening and closing |

The redundancy criterion: fewer than two tasks per agent. At five nodes, `Spec` and `Kit` do not merge under any conditions.

---

## 5. The numbers of a cycle

They arise as lines in card histories and as card movements across columns; `Intent` gathers them at closing, `Core` interprets them.

| Number | Who records it |
|---|---|
| Tasks in the cycle, of them tooling tasks | `Spec` |
| Passed the check on the first attempt | `Intent`, at each check |
| Returns on the form check | `Run`, when returning a task |
| Attempts beyond the budget | the one who stopped |
| `Core` exits | `Core` |
| Spend of the cycle | the human, from the environment's count |

---

## 6. Cycles

Three levels: **project** — the whole; **goal** — a segment of the whole; **cycle** — one pass over a goal.

```
AGENTS.md             law of the protocol §1–7 — one file for all environments, source of truth
.claude/rules/claude-8.md  §8 of Claude Code (read natively; no root CLAUDE.md)
.agents/rules/gemini-8.md   Antigravity wrapper: the `@AGENTS.md` line + §8 of the engine (`.agents/`)
.codex/CODEX-8.md     Codex wrapper: the `@AGENTS.md` line + §8 of the engine (`.codex/`)
README.md             entry for the human into the schema — why it is built this way
.forma/manual/               this documentation: SCHEME.md, PROTOCOL.md, assets/

project/              the project itself — the only thing here specific to a particular project
  PROJECT.md          tooling, thresholds, accesses
  CONFIG.md           project structure file by file + technical contracts of the environment + tooling log
  ROADMAP.md          what we build and in what order
  VARS/               what has already been decided, by entity files
    README.md         methodology: name/revision
    test-users.md     test users, who has priority
    credentials.md    access credentials for the site/project (prohibition 15, AGENTS.md §5)
  JOURNAL.md          records of closed cycles
  VALUE.md            attempts/tokens/value per each closed goal — written by Spec
  SETUP.md            preparation procedure before the first goal, universal for this type of project
  brief/              interviews with the human, references — recorded before the first goal
  docs/               description of what was done — the fourth door to the human
  mockups/            HTML/prompt drafts of pages + sitemap.md (site page map)
  reference/          project reference books — flat, with versions
  goals/              accumulated along the way
    goal-00-<name>/    the zero one: the system is ready for work
    goal-01-<name>/
      GOAL.md         segment, end-image, goal references
      materials/      data of this goal
      round-01/       the result — inside the card itself; there is no separate result directory
      round-02/       if the goal was not closed by the first cycle

.claude/              Claude Code environment
  agents/             the five nodes; as many doers as there are competencies
  .forma/skills/             skills of the project
  hooks/              checks at session start
  scripts/            tally.cjs (spend accounting), external-model-bridge.cjs (external model for Run/Spec — AGENTS.md §3)
  settings.json, .mcp.json   tool permissions, connected MCP servers
  scratch/            session drafts — not in git

.devtool/
  features/           the Kanban Markdown extension board: card — file, status — in frontmatter (`status:`), not in a subfolder
    done/             closed cards — the only physical move (`AGENTS.md` §7)

.forma/dashboard/            part of the forma core (not a separate plugin) — live visualization of the board (generate.js/serve.js/index.html), `node .forma/dashboard/serve.js` → localhost:5050, updated via SSE when a card is edited; watch.js/ensure-running.js — self-recovery
  graphify.config.json  trigger for graph rebuild (based on accumulated history) + doer (external-model/subagent/manual) — configured together with the human when installing the core
  graphify-trigger.cjs  accumulation counter, called from serve.js on every slice rebuild
  graphs/manual/      knowledge graph over the engine corpus (.forma/manual/) — moved from .claude/graphs/, not carried with the forma plugin
  graphs/project/     knowledge graph over the project/ corpus (graphify) — moved from project/graphs/
  graphify.log        journal of /graphify runs — outside the production route, its own format
  .cache/             runtime (data.json, watch.log, graphify-pending.json) — not storage, rebuilt from scratch; separate from code

.agents/              skills and conventions not tied specifically to Claude Code

.forma/protocol/   the «Форма» protocol, packaged as a reusable Claude Code plugin — a separate git repository, published on GitHub (see §5, "Layers")

.vscode/              editor settings (extensions for the board etc.)
.obsidian/            the repository as an Obsidian vault
```

The `project/` directory and everything under it is a choice of a particular project; the schema does not require it: elsewhere `PROJECT.md`/`ROADMAP.md` may lie directly in the root. `.vscode/`, `.obsidian/`, `.agents/` are tools around the schema, not the schema itself; another project may not have them at all.

**Rule:** a new directory — a new line in this tree, in the same attempt in which the directory was created. A directory without a line here is considered superfluous: either it has no place in the schema and should not have appeared, or the tree was forgotten to be updated and must be amended. The one who created the directory makes the entry — usually `Kit` during tooling or `Run` on the result; outside a cycle — the human.

A goal is taken such that its tasks fit within the volume threshold: a site page — a goal, its sections — tasks. A goal is closed when, in `GOAL.md`, in the cycle table, the "What remains" column is empty; otherwise the next cycle opens, and its segment equals the remainder, not the whole goal anew.

| File | Written by | Cached |
|---|---|---|
| `GOAL.md` | `Intent` at goal opening | yes |
| card — top | `Spec` | arrives with the task |
| card — bottom | `Kit` | arrives with the task |
| card — result | `Run` | no |
| `docs/` | `Run` on a card of the "work" kind, visible to the human | no |

One act — one file; whoever writes it owns it. A card is a file on the board, in four zones: the top is written by `Spec`, the bottom by `Kit`, the history — by `Spec`, `Kit` and `Intent`, each with their own line on their own event, without rewriting others', the result (after the history) — `Run`, having finished the work: what actually came out, not a chronology. Everything about the task — in one file; there is no separate file for history or result. **The language of the cards follows the project language from `project/PROJECT.md`:** if the project is Russian-language, the zones are named in Russian (`## Задача`, `## Снаряжение`, `## История`, `## Результат`), field wording and the kind (`дело` / `оснастка`) are written in Russian. The basic canonical structure is preserved; both forms are functionally equivalent. A closed folder is not cleaned or rewritten.

**The zero goal — `goal-00`.** An ordinary goal with its own `GOAL.md`; there is no separate entity. Segment: **the system is ready for work**. All tasks in it have the kind `оснастка`.

It is usually closed in two cycles — because the second depends on the first and they cannot be sliced at once:

| Cycle | Segment | Result |
|---|---|---|
| 01 | name the subject | agents and skills set up in `.claude/` |
| 02 | bring the tooling up to the named subject | gaps from the "Tooling of the nodes" block closed |

It opens when the honest answer to the question "at what level should this be done" is "don't know". Familiar with the subject but no tooling — one cycle suffices. Familiar and tooled — there is no zero goal at all.

The remainder rule is general: closed when the "What remains" column in the cycle table is empty.

**A readiness check is never a cycle.** Comparing what was declared in "Tooling of the nodes" with the arsenal is reading two lists, not work: `Kit` does this at the opening of any cycle, and before the start the `check-ready.sh` hook names any discrepancy. Gaps are closed by cycles, not found by them.

Solutions on the work found along the way are recorded, but the zero goal is not continued on them: the first working goal opens anew, with its own end-image.

The inventory is updated by event — a tool connected or disconnected, an access expired — and the change goes into `JOURNAL.md` as an infrastructure change.

---

## 7. Who talks to the human

Three doors, depending on the subject of the conversation. Open while a cycle is running; before the start there are no doors — the human fills in `PROJECT.md` and sets up the agents themselves.

| Door | Subject | What the human changes |
|---|---|---|
| `Intent` | what should result | end-image, segment |
| `Kit` | what it is done with | accesses, tools, data, skills |
| `Core` | how the work is structured | thresholds, composition of the schema, rules |

`Kit` gives resources to a task. `Core` changes the limits and rules under which the work proceeds. These are different things and must not be confused.

**Law of the external voice and the integrity of the Form (`forma`):** The five nodes are a single organism, where only those holding the external frontiers face outward:
- `Intent` — the constant external voice and the heart of the Form before the human. It overcomes the "lone-wolf syndrome", does not fuss and does not try to code or solve everything itself: it holds the human's design, knowing that its brothers carry the execution.
- `Kit` — speaks outward only when necessary: when a task requires a key, access or authorization from the human (the "human" line in the route); otherwise it kits the doer in silence.
- `Core` — speaks outward only on a threshold violation of a cycle or on a stop of an unachieved cycle.
- `Spec` and `Run` — have no external voice to the human: Spec's clarity is expressed in clean cards for Kit, and Run's truth is proven exclusively by fact in the "Result" zone.

**`Spec` and `Run` do not talk to the human.**

Slicing is derivative of the image and of the arsenal: if you dislike the partitioning — argue with `Intent` or with `Kit`, otherwise the human will dictate the parts and the measure will stay the same.

`Run` without memory: what is said to it vanishes together with the attempt. A conversation with a doer is a workaround of the check, and besides, it does not physically persist.

**A request is not a conversation.** The node that lacks a resource submits the shortage directly to the human, with a line carrying an address, and the line remains in the card's history.

**Human intervention is recorded as a change** — into the card's history, in the same order as any other (prohibition 11). The human is the master of the work and may intervene anywhere; but an unrecorded intervention after two cycles is indistinguishable from substitution, and by the numbers it will be visible that the apparatus worked, although it was the human who worked.

There is no `Core` in the collapsed schema — the human decides about the apparatus themselves.

---

## 8. Dashboard

The human needs a way to see the state of a cycle and the spend without opening cards one by one — the same argument for which the board exists: what is gathered in files becomes visible only when someone brings it together. The board shows where each card is now; the dashboard — what became of them and what it cost: spend by nodes and money, default tooling of the nodes, the knowledge graph over both corpora.

**The third territory, neither "Schema" nor "Project".** The dashboard takes data from both sides at once: the board — from `.devtool/features/`, both graphs — from the schema corpus (`.forma/manual/`) and the work corpus (`project/`) simultaneously. Placing it inside either half would mean lying about the boundary: `.forma/manual/` is universal and carried with the `forma` plugin as is, while the dashboard is not carried with it (it takes data of a specific instance, not the protocol itself) — and it does not belong to `.devtool/` either, that territory belongs entirely to the Kanban Markdown extension. Therefore `.forma/dashboard/` is a separate directory in the root, neither inside `.forma/manual/`, nor inside `project/`, nor inside `.devtool/`.

**Not storage, but a cache — the same principle as for the cards.** Everything the dashboard shows has already been recorded somewhere else (in the card's history, in the agent's frontmatter, in the journal of runs): `generate.js` reads these records and rebuilds the slice, deciding nothing and judging nothing by eye. Removing the dashboard — not a single fact is lost, only the way to see it.

| What it shows | Source | Live recount |
|---|---|---|
| Spend by epics and by nodes | card history lines (`AGENTS.md` §3) | yes, on editing any card |
| Spend in money (external model) | same format, money segment | yes |
| Default tooling of the nodes | frontmatter of `.claude/agents/*.md` | yes |
| Knowledge graph — corpus `.forma/manual/` | `.forma/living/graphs/manual/` (built via `external-model-bridge.cjs` directly, not via the `graphify` skill itself) | no, until the next manual build |
| Knowledge graph — corpus `project/` | `.forma/living/graphs/project/` (built by the `graphify` skill) | no, until the next manual build |
| Knowledge graph — experience of closed cards | `.forma/living/graphs/done-cards/` (built over `.devtool/features/done/`, the full card text) — not an advisor to Spec by judgment, an accelerator of Recon on already verified facts | no, until the next manual build |
| Journal of `/graphify` | `.forma/dashboard/graphify.log`, appended manually by whoever ran it | yes |
| "Graph due for rebuild" label | `.forma/dashboard/.cache/graphify-pending.json`, set by `graphify-trigger.cjs` when events exceed `graphify.config.json` → `trigger.threshold` | yes |

**Live recount — not polling on a timer.** `serve.js` watches `.devtool/features/` and `.forma/dashboard/graphify.log` via `fs.watch`; any change with a delay of a few hundred milliseconds (not to recount a tool-call record three times) rebuilds the slice and sends it to all open tabs via Server-Sent Events. An open tab requests nothing itself — it is sent to.

**Self-recovery — the same requirement as for any infrastructure: to work while no one thinks about it.** The dashboard does not start automatically on installation — it lies and waits until the human types `node .forma/dashboard/serve.js` themselves. But once started, it then watches itself: the `SessionStart` hook (`check-dashboard.sh`) on every session start checks whether the server responds, and if not — raises a supervisor (`watch.js`), which restarts the server on any unexpected fall with a growing pause between attempts. Neither blocks the session nor requires an answer from the human.

**Part of the core, not a separate plugin.** The dashboard and the knowledge graph are installed by the same `forma` invocation as the rest of the core (`.forma/protocol/skills/forma/template/dashboard/`) — no second invocation is needed. The forked copy of the third-party `graphify` skill nevertheless remained a fork with its own version — upstream updates are pulled manually, after a compatibility check, not automatically (the dashboard's README, "How to pull upstream updates", inside the core).

## 9. Reading levels of the schema

Schema files are not read with the same frequency, and a file's weight must match the frequency of its reading — otherwise the rare becomes a constant burden, and the frequent remains inaccessible in time.

| Level | Files | Who reads | When |
|---|---|---|---|
| 1 | `AGENTS.md` (+ §8 of its engine: `.claude/rules/claude-8.md` / `.agents/rules/gemini-8.md`) | all five nodes | every invocation, without exception |
| 2 | `.claude/agents/*.md`, `.agents/plugins/forma/agents/*.md` | the specific node | every invocation of exactly that node |
| 2b | `.claude/agents/on-demand/*.md`, `.agents/plugins/forma/agents/on-demand/*.md` | the node on which a rare event occurred (goal opening, schema housekeeping, stack recon, external model) | by event — the node reads the file with `Read` itself, does not keep its weight constantly |
| 3 | `.forma/manual/en/03-forma/PROTOCOL.md`, `.forma/manual/en/03-forma/SCHEME.md`, `project/CONFIG.md`, `project/PROJECT.md`, `project/ROADMAP.md` | the node that needs a specific fact/threshold/contract | on reference — not on every invocation |
| 4 | `GOAL.md` of the current goal, the card itself, `.claude/skills/*/SKILL.md` | the node working exactly with this goal/task/process | by event, even tighter than level 3 |

Moving content between levels is honest only in one direction of the criterion: not "where it is more convenient", but "how often this is actually read". Promotion to a more frequent level for imaginary convenience ("let it be at hand for everyone") is paid on every invocation of every node — more expensive than the saving where the content was taken from (precedent — an attempt to move the card formatting rule from `spec.md` to `CLAUDE.md`, rolled back in the same session after measurement: the move into a level-1 file cost more than the saving in the less frequently read level-2 file).
