---
model: minimax-m3.1-flash
---
# Card, form check and board (law §6–§7)

Sections 6 and 7 of the law, verbatim; numbers kept, so "§6" and "§7" elsewhere point here. Read before creating, editing or moving a card, or touching the board.

## 6. Card and form check

```
# · kind | what it delivers | readiness criterion | attempt budget | where it goes next
```

All five fields are mandatory. **Every card also carries exactly one goal label** in `labels` — `goal-NN` (a subgoal) or `goal-<code>` (a kind's main goal): the true link between the card and its goal; the epic is only its kind's lane (`intent-goal-opening.md`, "Epic"). Required of cards created from the day the rule entered the project (`.forma/living/checks.json`) on; `sync-engines --check` reports a missing or second label and an epic that doesn't match the goal's kind.

**Route labels sit beside the goal label** — labels, because the board rewrites the frontmatter to a fixed set of keys and erases any other (`ROUTES.md`, §9):

| Label | How many | Meaning |
| --- | --- | --- |
| `route-N` | exactly one | the card's route, `route-0`…`route-8` |
| `over-N` | zero or more | overlays, `over-1`…`over-4` |
| `seg-N` | one, `route-8` only | the goal segment |
| `wave-N` | one, `route-8` only | the wave inside the segment |
| `after-card-NNN` | zero or more | starts only after card-NNN is accepted |
| `trial` | zero or one | the trial card of its kind |

**Two different "segments".** `seg-N` and `route-8` slice **a goal** into segments of work (a unit of slicing, lives in the goal's `GOAL.md`); the epic "8. Competence segments" is **the store of experience and roles** (`project/experience/`) — a kind of goal. They share a word and nothing else: a `seg-N` label never places a card in epic 8, and a card of epic 8 carries no `seg-N` unless it runs `route-8` itself.

The reason for the route — and for any change of it — is a line in `## History` by whoever chose or changed it, with a reason code from a closed list: `` `Node`, YYYY-MM-DD: route route-N (why: <code>) — <detail>. `` A change reads `route route-2 → route-5 (why: <code>)`.

| Code | When |
| --- | --- |
| `human` | the human chose it — it looks faster to them |
| `ready` | the card is complete — five fields and kit already set, `Intent` wrote it all → straight to the executor |
| `scale` | a volume where the economics decide (`route-8`) |
| `risk` | an expensive error or a new stack (`route-7`) |
| `decision` | a question, not a delivery (`route-3`) |
| `tooling` | tooling or recon (`route-4`) |
| `plumb` | the Plumb confirmed a catalog role and `Spec` wrote it into `## Kit` — straight to `Run` |

**A Plumb reading is a line in `## History`**, written by `Spec` right after the call, never estimated: the §3 spend line of the call, whose description carries the reading: `` `Plumb`, YYYY-MM-DD: attempt, N tokens (R cache-read), T s, `<call id>` — <engine>: role <name>, N % (gap G, clarity C), <executor>, <fits / below threshold / returned>. `` An external executor is charged in its own unit before the dash (§3, "External service"); scrubbing is recorded as what and how many, never the values. The call is tied to the card like any subagent reach (below).

**The stage of the route is written, not guessed.** Whoever moves the card along its route — the same moment §7 has it sync `status` and `assignee` — appends `` `Node`, YYYY-MM-DD: stage <key> — <what>. ``, key from a closed list: `card` (the task is being written) · `approve` (awaits the human's "yes") · `kit` (kitting) · `exec` (execution) · `check` (`Intent`'s check) · `accept` (awaits the human's acceptance) · `close` (awaits `Core`). On `accept` and `close` the caller may add `--session-spend <NNN>` to `card-move.cjs`: the same call then appends `Intent`'s own spend line (`card-session-spend.cjs <NNN>`, `spend-line.md`) before the stage line — one call instead of two. The last stage line is where the card stands; a stage the route lacks is not written. The key part (`route`, `why`, `stage` and the codes) is English in every language, like a spend line (§3). `sync-engines --check` reports a missing reason, an unknown code or key, and a last stage that contradicts the status.

Required of cards created from the day the rule entered the project (`.forma/living/checks.json`) on.

**A `work` card whose result is read by someone other than the human** — a node, a script, the next card — names that consumer and the form it needs in the criterion. Otherwise the result passes its own check and fails where it is used.

**Kind is `work`, `tooling` or `decision`:**

- **work** moves the goal closer to its end-image;
- **tooling** makes work possible and doesn't move it closer: setting up a tool, formalizing a skill, wiring up access;
- **decision** closes a question, not a delivery: "what it delivers" is the question named; the criterion — what a decision must settle and who takes it; budget — attempts at gathering the grounds; `## Result` — the decision and its grounds. Checked by one thing: the decision answers the named question and its taker is the one the criterion names. Work resting on an open question isn't sliced until its decision card closes.

Kind matters at check time: a tooling task is checked against its own criterion and is **not** required to show progress toward the end-image. Without the marker it would be rejected as a slicing failure. `Run` doesn't start until every field is filled and access, data and tools are in place.

**Fog and out of scope** — `GOAL.md` sections "Not yet specified" and "Out of scope". A question that can be **named** now is a `decision` card; one that can't yet is fog, and fog isn't sliced. The test and the rules — `intent-goal-opening.md`, "Record".

**Decision log and glossary.** `project/adr/` (closed decisions) and `project/ops/GLOSSARY.md` (domain terms) are kept by `Intent` (`intent.md`, "Glossary and decision log"). Other nodes use the glossary's terms and name a conflict (§2), never redefine one.

**Project knowledge lives in project files, not in an engine's memory** — written at the moment it appears, by the route of the skill `project-knowledge`.

**Three layers of files — what lives where.** A fact or setting of this product found at work is written to `project/` by `project-knowledge`, never into a role, skill, script, manual or the protocol source; a skill that needs product data reads it from `project/` by path.

| Layer | Where | What | Travels to the protocol source |
| --- | --- | --- | --- |
| 1. Node roles and skills | the engine adapter directories (`.claude/`, `.agents/`, `.codex/`) | the method itself — portable, carries no fact of a specific product | yes, by `engine-to-protocol.cjs` |
| 2. Shared across engines | `.forma/` (protocol clone, manual, dashboard) | the law and its machinery, identical for every project | this layer **is** the protocol source |
| 3a. Project extensions | `project/extensions/<engine>/` (`claude` → `.claude/`, `codex` → `.codex/`, `agents` → `.agents/`) | what the project builds on top of the protocol — its own roles, skills, scripts, hooks. Written here, never into the engine folders, which hold generated copies; survives `uninstall` and reinstall; a file here replaces an engine file of the same name | only by a deliberate promotion, by `engine-to-protocol.cjs` |
| 3. Product | `project/`, `.forma/living/`, `.devtool/` | this product's data and settings — a site snapshot, credentials by reference, design tokens, goals, cards, board, project history | never |

Prohibition 16 names the clean zones this keeps clean; the release check (`check-release.cjs --traces`) catches only pattern-matched traces (card codes, dates, domains, emails, hashes) in layers 1–2 or in the protocol source — not every product fact.

**Any reach to a subagent is tied to a card — no exceptions.** A production node (`Spec`/`Kit`/`Run`/`Core`) or a one-off helper call (checking a fact, a piece of documentation, whether something is alive): the card is opened before the call — the five fields, or for a light one-off check at minimum the task statement and the readiness criterion — and filled in after it returns, with the result and the spend (§3). Nothing invoked as a subagent goes unrecorded. **One call may serve several cards** — a batch (`Spec` slices several tasks per call, `Kit` kits up to 4 cards per call): every card of the batch is opened before the call and filled after it, each with its own spend line, the call's spend split between them and the split named. One agent per card remains for different subjects or dependent cards. **Not retroactive:** a one-off call made before this rule existed doesn't get a card invented afterwards — `.forma/living/CHANGELOG.md`.

**A card is a file on the board, in four zones, each under its own heading, in this order:**

```
# <title>

## Task
   № · kind | what it delivers | readiness criterion | attempt budget | where it goes next

## Kit
   Role · Skill · Tool · Access · Data · Model                       ← six units (`kit.md`)

## History
   - `Node`, YYYY-MM-DD: attempt, N tokens (R cache-read), T s, `<call id>` — <what was done>.
   - `Node`, YYYY-MM-DD: <an event that was not a call, in one or two sentences>.
                                                                    ← format, §3

## Result
   Empty until executed — not a timeline.
```

| Zone | Written by | Note |
| --- | --- | --- |
| `## Task` | `Spec` | the five fields, nothing added beyond them |
| `## Kit` | `Kit`, or `Spec` when a ready `Run` profile from the catalog fits a routine card | details — `kit.md`, "Task kitting"; the ready-profile route — `route-choice.md` |
| `## History` | `Spec`, `Kit`, `Intent`; for an external-model attempt, the calling node | each appends a line on their own event — **never overwrites someone else's, only adds** |
| `## Result` | `Run`, once done | what actually came out: what was created or changed, how it was confirmed — not a timeline |

There is no separate file for history or result — the task's whole life is in the one card file. Frontmatter `status`/`assignee` — §7.

**A card carries a code** — the `card-NNN` prefix of its filename (goals: `goal-NN`); the title may change, the code never, and everything points at the card by it.

**Material born of a card** — interview records, prototypes, evidence, an external model's output — lives in `project/cards/card-NNN/`, outside the board (the card moves into `done/`, the folder must not). The folder keeps the grounds, the card keeps the decision; project material is referenced, never copied there.

**The card's language follows the project language** in `project/config/PROJECT.md`: for a non-English project the zone headings, fields, kind (`дело` / `оснастка` / `решение`) and notes are written in it (`## Задача`, `## Снаряжение`, `## История`, `## Результат`); the zones and mandatory fields don't change.

---

## 7. Board

`.devtool/features/` is a `kanban-markdown` extension; the status enum is fixed in that skill's own `references/data-model.md` (the engine's skills directory, §8). A node taking a card syncs **both** `status` and `assignee` in the frontmatter, never one of the two:

| `status` | Held by | `assignee` |
|---|---|---|
| `backlog` | sliced by `Spec`, not yet taken into work | `"Spec"` |
| `todo` | `Kit` (kitting) | `"Kit"` |
| `in-progress` | `Run` (execution) | `"Run"` |
| `review` | `Intent` checks against the criterion and presents the result to the human | `"Intent"` |
| `done` | the human accepted; the cycle is not closed until `Core` has closed it | `"Core"`, then `null` |

- **The short route — the card's label `route-4`:** `Intent → human → Kit → Intent`. `Spec` is **replaced**, not skipped: its function — a readiness criterion written by someone other than the one who accepts by it — passes to the human, who approves the card's five fields before `Kit` is handed it. **Condition of validity:** that approval is a **reply in the session, not a call**, written into `## History` as an event line without `attempt` (`ECONOMY.md`, "`Intent` in the shared session"); until that "yes" the card stays in `backlog`. `Kit` kits and executes as one node: `in-progress` is held by `"Kit"`, not `"Run"` (`kit.md`, "Infrastructure"). **The route belongs to the card, not to the epic:** an epic is only a lane of its kind of goal, it carries no route; who holds `in-progress` is read from the card's `route-N` label (§6) — `route-4` `"Kit"`, `route-0` and `route-1` `"Intent"`, the rest `"Run"`. A card without the short-route label is sliced by `Spec` or runs the route its own label names; skipping `Spec` on a route that needs it is a breach, not a route. Choosing the route is `route-choice.md`'s, not the epic's. This is not the code phrase (§1): nothing is stepped outside the route, so prohibition 11 does not apply.
- **Cards `Intent` executes itself (`route-0`, `route-1`):** `in-progress` is held by `"Intent"` — typically documentation for the human (epic "2. Project structure") and a discussion card `Intent` resolves itself (epic "6. Discussion of affairs"); the confirmer is the human, never `Intent` (prohibition 1). A discussion card holding a list of tasks, and documentation for the human — `intent.md`, `intent-goal-opening.md`.
- **The wave gate.** A card of wave N+1 is not taken into work until every card named in its `after-card-*` labels is accepted — not the whole previous wave. A card that fails acceptance returns to `Kit` and reruns in the same wave; cards depending on it wait, independent ones go on.
- **A "didn't get there" return goes to `todo`+`"Kit"`, never a drop into `review`** (§2); it reopens in `in-progress` after reassembly. Or it goes to `backlog` for fresh slicing, or the process stops outside the kanban.
- **`backlog`+`assignee: null` on a card `Spec` didn't create is a signal, not an error**: it never went through slicing — ask the human (`intent-session-start.md`).
- **`done` is two states in one column, told apart by `assignee`:** `"Core"` — the human accepted, the cycle is not closed; `null` — `Core` closed it. The file moves (`{id}.md` ↔ `done/{id}.md`) when the status becomes `done`; the board extension does it itself — no node holds it, nothing can be gated on it.
- **`Core` closes a cycle's cards together, not one at a time** — a verdict on a single card would be `Intent`'s check done twice. A cycle lives inside one epic: accepted cards (`done`, `assignee: "Core"`) are counted per epic; at the volume threshold `Intent` hands them to `Core`, earlier only on the human's command; the count is reported at session start and after each commit (§8, start hook). **The human's acceptance comes before `Core`:** the human judges the outward thing, `Core` what is not visible from there — whether the cycle reached the end-image. Two judgments in a fixed order, neither replacing the other. **Closing is one call for the whole cycle:** `node .forma/board/card-move.cjs --to core-close <NNN…> --note "<grounds>"` writes the `закрыто —` history line and sets `assignee: null` on each named card (status and other fields untouched); an unknown number stops it before any write.
