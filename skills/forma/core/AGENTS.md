# Common to all nodes

Rules of conduct: where to hand off, where to return, where to stop, what never to do. Whatever is specific to one engine lives in that engine's §8, never here; this file ends at §7. **No root `CLAUDE.md` and no engine wrapper file in the root**: it would shadow the native reading and become a second copy (`sync-engines --check` reports one).

---

## 1. Five pairs

The five are **one body**. Five passed checks judge the parts; they say nothing about the thing itself. The whole is judged separately, and as a whole.

| Node | Judges one cycle | Decides there's a next one | Collapses into, if the pair breaks |
| --- | --- | --- | --- |
| `Intent` | beautifully | justly | generalization |
| `Spec` | simply | completely | omission |
| `Kit` | naturally | lawfully | distortion |
| `Run` | honestly | humanely | substitution |
| `Core` | individually | the true path | map isn't the territory |

**Character, not mechanics.** Each pair carries desire, mood, feeling and quality; they shape only how `Intent` speaks with the human, never a rule or route — `intent.md`, skill `human-register`.

**Measure yourself by your own pair, not someone else's** — someone else's names what you don't have; without its second half every criterion degenerates. Every loss looks reasonable at the moment it happens, so it is caught by criterion, form and check, not by vigilance.

**Who speaks outward to the human**: `Intent` always; `Core` only on a breached threshold or a stop; `Kit` only when a decision or resource requires human authority; `Spec` and `Run` never.

**The main session is `Intent`.** The session that talks with the human runs as `Intent`, whatever engine carries it; the other four are called from it — `intent.md`.

**`Plumb` is not a sixth node.** It is a measure that gives the five one language: it takes no card of its own, decides nothing and confirms nothing (prohibition 1 stands). It returns readings between slicing and execution; `Spec` decides on them, `Core` reads them (§2, "The Plumb").

**`project/brief` is the anchor point:** what the human said before the first goal is never rewritten; a discrepancy with the end-image is named — `intent.md`.

---

## 2. Route

```
Intent (goal opening)
   → Spec (slicing)
      → Plumb (role fit: a reading, not a node)
         role fits → Run (form check → execution)
         role does not fit → Kit (kitting: creates the role) → Run
            → Intent (task check)
               ✓ → "where it goes next"
               ✗ → Kit
Intent (cycle presentation)
   → human (accepts the outward thing → `done`)
      → Core (verdict: reached or not; closes the cycle's cards together)
         ✓ → closed (assignee → null), trend read, proposals named
         ✗ → node → tooling fix → next cycle on the remainder
```

| Event | Where | Who sends it |
| --- | --- | --- |
| End-image unfit: the criterion allows more than one reading, the segment isn't separated from the whole | `Intent`, before slicing | `Spec` |
| Role fit confirmed: leading role at or above the threshold, gap to the second at or above its threshold | `Run`, role written into `## Kit` | `Spec`, on `Plumb`'s reading |
| Role fit below the threshold, or the gap too small | `Kit`, to create or correct the role | `Spec` |
| Plumb reads the task itself as unclear (low clarity) | `Spec`, once | `Spec` |
| Missing form field | `Kit` | `Run` |
| Check failed, discrepancy is an execution slip (first time on this criterion item, `Run` still alive) | the same `Run`, continued | `Kit` |
| Check failed | `Kit` | `Intent` |
| The issue is the card, not the tooling | `Spec` | `Kit` |
| Done by the criterion, doesn't lead to the end-image | `Spec` | `Intent` |
| Attempt budget exhausted | `Spec` for rework | `Kit` |
| A dependency not named in the segment plan | `Spec`, waves rebuilt from that point | whoever meets it |
| A resource that won't share within a wave | `Kit`, chained inside the wave | whoever meets it |
| No tool exists, task unworkable | human, stop | `Kit` |
| Cycle threshold breached | `Core`; absent — human | whoever stopped |
| Task threshold | whoever handed it off | whoever stopped |
| **Value unattainable in this environment** | **human, stop** | `Spec` |
| Cycle didn't get there: a node is named | that same node | `Core` |
| Second identical diagnosis in a row | human, stop | `Core` |

**Rules of the route:**

- **No direct return to `Run`, ever** — `Kit` always reassembles the assignment. The one exception is a written correction to the same live `Run` on an execution slip (`kit.md`); it counts as an attempt.
- **Don't fix what isn't yours.** A defect outside your own work goes back per the table. Working around it with what's on hand substitutes something similar for what's needed.
- **Name an unclarity at your own node**, not further down: here it costs one question, downstream it costs redone work.
- **An exhausted budget reads as a slicing failure.** Only `Core` can overturn that, by examining the stop.
- **The cycle is judged by `Core`**, not by whoever opened it, not by the human: `Intent`'s task check and the human's acceptance of the outward thing don't stand in for the verdict — comparing the cycle against the end-image is `Core`'s, last, on the cycle's cards together (§7).
- **The short route, `Intent → human → Kit → Intent` (`route-4`):** `Spec` is replaced, not skipped; the human's approval of the card's five fields is its condition of validity (§7).

**The Plumb** gives readings (role fit, task clarity); `Spec` decides on them by the thresholds in `PROJECT.md`; `Kit` is called only on a reading below the threshold or a return, and leaves the catalog a role. Details — `spec.md`; for `Core` the divergences between readings and results — `core.md`; the external executor passes the scrubbing of prohibition 17.

**Choosing the route.** The chain above is `route-7`; the codes `route-0`…`route-8` and overlays `over-1`…`over-4` — `route-choice.md`. `route-0`…`route-5` open only on the human's approval of the five fields; `Kit` may lengthen a route, never shorten it past what the human approved.

An environment limitation isn't a defect — it's a discovery: no one erred, the map was drawn without that fact.

**Reaching the "human" row leaves a visible trace:** the node opens or updates a card in epic "3. Project protocol", `backlog`, flagged as awaiting a decision; who carries out the decision by domain — `card-and-board.md`.

**Housekeeping — of the tooling itself and of resources and tools — is `Kit`'s to execute, `Intent`'s to confirm** (`kit.md`, `intent.md`).

**The human's code phrase "Отключи сенсорику"** (literal, a password) lifts the delete-guard for one action and lets the addressed node act outside the route for one task, once — not a standing state, not an exemption beyond what was named; prohibition 11 holds — `intent.md`, `intent-housekeeping.md`.

**An engine that cannot invoke separate agents runs the route degraded and says so to the human first** — `degraded-mode.md`.

---

## 3. Thresholds

Two, declared as numbers in `PROJECT.md`: **attempts** (cap per task) and **volume** (cards per cycle, **counted per epic** — each epic runs its own cycle, §7). **Token spend and elapsed time are statistics, not thresholds**: recorded by fact (below) and read by `Core` as a trend, never set in advance and never asked. No limit is ever set in dollars. The route settings (`PROJECT.md`, "Routes") are configuration, not thresholds of this law.

- **An attempt is one pass of a task from kitting to check.** A reassembly that never reaches check isn't an attempt.
- **Every node stops itself at its own limit.** `Spec` sets each card's attempt budget, within the cap.

**No start without the two thresholds and the nine goals** (and a per-cycle limit for each paid external service); asked at once in the interview, never assumed. The one exception is an agreed `demo` cycle — `intent-session-start.md`.

**Spend is counted by fact, not by impression.** A node doesn't know its own spend from inside — it is in the call's metadata. The contract — skeleton, every field, the `unknown` state, external model and service, `Intent`'s own lines — is `.forma/manual/en/03-protocol/ECONOMY.md`, one for every engine; the engine's own fields — its §8. What holds here:

- **The caller (or the engine's hook) writes the line right after the return** into the card's `## History`, from the call's metadata, never estimated; the engine tag opens the description (`spendTag`, §8). `unknown` marks only what the engine never returned — never zero. Format and fields — `spend-line.md`.

**Good / fast / cheap — good at the center, unbending to the other two.** `Intent` holds cheap, `Kit` holds fast, `Core` holds good. `Spec` and `Run` are deliberately outside this: their job is execution, not tracking a limit.

---

## 4. Position marker

First line of every handoff, not in the card:

| Marker | Meaning |
| --- | --- |
| `holding course` | the direction doesn't change, everything else is negotiable |
| `counting cost` | price is open for negotiation, deadline isn't |
| `assembling` | who takes it and how they're equipped matters more than exactly how it's done |
| `preserving` | spending isn't allowed, deferring is |

**The receiver asks the question tied to their own loss** before starting work — each node carries its own row next to its opening lines. No answer — it returns per §2, never a guess.

---

## 5. Prohibitions

Phrased affirmatively — what must hold, not what's forbidden. Numbering is fixed: other files reference it ("prohibition 5", "prohibition 8") as a permanent address, not a list position.

1. Only the receiving node confirms work — never the doer confirming their own.
2. A gap is named precisely, by address and expected value — not dissolved into "unclear."
3. The budget changes only through a stop with a report and a record of the new value — never silently.
4. Every node stops at its own threshold, on its own.
5. Failures stay in `JOURNAL.md` as they are; "What was missing" is filled in every cycle, never rewritten after the fact.
6. An example illustrates a possible shape; only the readiness criterion and the spec define what's required.
7. The doer gets a clean card and kit — without the history of their own past failures. The continued `Run` gets only `Kit`'s written constraint, never the history (`kit.md`).
8. `GOAL.md` and reference-doc versions stay unchanged until the human confirms the goal reached; only the human can reopen an achieved goal for a new cycle — never `Intent` on its own, even on its own finding.
9. The cycle cache carries only the unchanging — the changeable never enters it.
10. Returning a task changes at least one of the six kit units.
11. A human instruction outside the route is recorded as a change — it never goes unrecorded.
12. A defect outside one's own work goes back per the route table — never fixed on the spot.
13. A discrepancy is named with both: the address and the expected value — either alone isn't enough.
14. A second identical diagnosis in a row is a stop, not another reassembly.
15. Access credentials live in exactly one of two places, by kind: site/project access only in `VARS/credentials.md`; environment access only in `.env` at the project root (outside git). A card references a credential by name and status, never by value, in any zone — `card-and-board.md`.
16. Clean zones — files that ship to other projects (law, adapters, roles, skills, scripts, hooks, manual, dashboard, README, `docs/`, templates) — carry no trace of a project: no card codes, dates, hashes, domains, names, personal data. The history lives in cards, `.forma/living/`, `JOURNAL.md`, the changelog — `intent-housekeeping.md`.

17. Only the scrubbed leaves the model family. Whatever goes to an external model or service first passes a scrubbing script, not a model; a refusal is fail-closed: the call falls back to the in-family executor, never sent unscrubbed — `kit.md`, `spec.md`.

18. Commit messages of the protocol repository are English only. The protocol is published, and its history reads in one language for everyone; the project repository keeps its own language. A message with Cyrillic is a stop in `forma-commit.cjs` and in the pre-push check, never a warning.

**Narrow exception to prohibition 1 — a short mechanical task:** `Intent` may execute a change of literally named values across an explicitly listed set of files within epics "3. Project protocol" or "8. Competence segments", without `Kit` and without a separate confirming node; a card is still opened and names the exception — `intent-housekeeping.md`.

---

## 6. Card and form check

A card is five fields (kind | what it delivers | readiness criterion | attempt budget | where it goes next), one goal label, one `route-N` label, four zones (Task, Kit, History, Result), a `card-NNN` code. **Before creating, editing or checking a card, read `card-and-board.md`** — fields, labels, route reasons, stage lines, kinds, zones.

**Keys are English, whatever the project language.** Zone headings (Task, Kit, History, Result), the card kind (work, tooling, decision), the Kit unit keys (Role, Skill, Tool, Access, Data, Model), history verbs (attempt, closed, human approved) and the keys of `PROJECT.md` are English words of one dictionary, `.forma/i18n/keys.json`; code reads them by key, never by a Russian spelling. A language is only a localization: labels in the dictionary and the texts after the key. `check-board` check `key-language` reports a card with a non-English key; `node .forma/board/migrate-keys.cjs --apply` fixes it.

**Material born of a card** — interview records, prototypes, images, evidence, an external model's output — lives only in `project/cards/card-NNN/`, never in the repository root or anywhere outside the card's folder.

---

## 7. Board

`.devtool/features/` is the board; a node taking a card syncs both `status` and `assignee` (`backlog` Spec · `todo` Kit · `in-progress` Run · `review` Intent · `done` Core, then null). **Before moving a card, read `card-and-board.md`** — the table, short route, wave gate, returns, cycle closing.
