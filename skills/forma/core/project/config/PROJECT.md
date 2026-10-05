# Project configuration

Filled in for the specific project and lives for its whole life. The rules are in `AGENTS.md` and do not change.

Here — what we work with and at what level. What we build and in what order — in `ROADMAP.md`. A segment — in `goals/goal-NN/GOAL.md`.

**Project language** <!-- k:language --> *(human, before start; sets the language of task cards, goals and documentation — `AGENTS.md` §6)*: English. The documentation of the scheme itself (`manual/`) is not translated into the project language: it exists only in English — the original, `manual/en/` — and Russian — an exact copy, `manual/ru/`.

**What we do** *(human, before start)*:

**Project template** <!-- k:template --> *(human, at install; `Intent` picks the branch of the fifth interview position by this field — reads it, does not infer it from which files exist)*:

| Field | Value |
|---|---|
| Name <!-- k:name --> | — |
| Source <!-- k:source --> | — |
| Status <!-- k:status --> | `none` |
| Route | `project/config/ROUTE.md` — the reference for the fifth interview position |

**Three possible statuses, a closed list:** `verified ready` — the route has been walked to a result, the fifth position reduces to a check; `forming with the human` — the route is partly written, check against what is written and build what is missing; `none` — unknown territory, no route exists, all five positions are worked through at equal depth. The interview script is the same either way and comes with the core: a template adds only a reference to the fifth position.

**Project epics** <!-- k:epics --> *(human, before start; each one's role and procedure are fixed, `intent.md`, "Epic", the code in brackets cross-checks them; the name in this column is the only thing set per project here)*:

| Code | Epic in this project | Function |
|---|---|---|
| `value` | 1. Value/Intent+Kit | a remark on the production spend of the project itself — tokens, cache, attempts, the price of a cycle: `Core` reads the trend, `Intent` holds "cheap" |
| `docs` | 2. Documentation/Intent | documentation of the product itself, for the human: user, administrator, technical — how to work with what we produce. The goal's cycle is closed and the promise it gave must be shown restrained: `Intent` reads the "Result" zones of the closed cards, looks at the live result and writes a `project/docs/` section for the human |
| `forma` | 3. Form/Intent+Kit | a node reached the "human" row of the route; also `Kit`'s reconnaissance of an unfamiliar stack before slicing |
| `result-image` | 4. Result image/Intent | the `grilling` interview at the opening of a new goal |
| `core` | 5. Core remarks/Core+Intent | `Core`'s proposals when closing a cycle: `Core` writes a remark, `Intent` sorts it by domain |
| `incoming` | 6. Incoming/Intent | a correction or task that appeared along the way and need not go into production at once: `Intent` either resolves it quickly itself and closes the card, or sends it to `Spec` for slicing. Also here — a card without slicing and a defect outside the current goal |
| `goal` | 7. Production/SKRIC | the product itself: the main goal `goal-goal` and subgoals `goal-NN` in one lane, the goal is chosen by label |
| `experience` | 8. Experience/Intent+Kit | weeding the `project/experience/` store: diverged keys, contradicting records |
| `review-image` | 9. Review image/Intent | outside the production cycle. The human's own testing process, formed by them for themselves: how the result is checked, corrections to the work and testing, additions to what was meant to be obtained in the end result — the result image and the final acceptance/testing may differ. It is an addition to an already formed goal, not a rewrite: `GOAL.md` does not change (prohibition 8), the addition is recorded beside it, and only the human turns it into a new goal or a reopening. Its own testing procedure, tied to separate processes |

**An epic is a kind of goal, a goal is a label.** The nine kinds run in parallel; each has a main goal `goal-<code>` and, if needed, subgoals `goal-NN` (continuous numbering). A card carries exactly one goal label in `labels` — that is the true link; the epic is only the lane of its kind (`AGENTS.md` §6, `intent-goal-opening.md`, "Epic"). Who forms each kind's goal — there too, "How goals are formed".

**Kinds of documentation** *(human, a decision per project; which kinds exist here at all is a list, not an obligation: which of them a specific goal owes is said by its result image, epic "4. Result image/Intent")*:

| Kind | For whom | What it holds |
|---|---|---|
| | | |

**The list of kinds is not an obligation on every goal.** The project declares which kinds exist here; which of them a specific goal owes is named by its result image. A goal whose image is silent about documentation owes none — adding a kind after the fact would widen the promise after it was given, and that is the human reopening the image, not a node's decision.

**Where it lives.** `project/docs/goal-NN-<name>/`, one file per kind. A goal's section accumulates over cycles rather than being rebuilt: each closed cycle appends its own.

**Thresholds** <!-- k:thresholds --> *(human, before start; `Core` revises them only through a stop with a report)*:

| Threshold                         | Value                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| Attempts per task <!-- k:attempts --> |  |
| Cycle volume, cards (per epic) <!-- k:volume --> |  |

Spend in tokens and elapsed time are statistics, not thresholds: they are written by fact (AGENTS.md §3), never set in advance and never asked. No limit is set in dollars.

**Node qualification** — not a separate field, not filled in beforehand. Each node has its own source of level, read on the spot when the node actually looks at a task:

| Node | Source of level |
|---|---|
| `Intent` | brief/interview — learns along the conversation who in this field judges the result |
| `Spec` | `ROADMAP.md`/`GOAL.md` of the specific goal — how work is customarily sliced here, on the spot, at slicing |
| `Kit` | its own search of the arsenal (skill `skill-authoring`, "Sources of the ready-made") — checks for itself what to work with |
| `Run` | card + the kit issued by `Kit` — the level is already in the task, no need to name it separately |
| `Core` | does not vary by project — a fixed role of the protocol (`PROTOCOL.md`, "Qualification") |

Level flows along the chain of documents that are in front of the node anyway (brief → `ROADMAP.md`/`GOAL.md` → card → kit), and is not stored as a separate line the human must invent before the start.

**Node tooling** <!-- k:tooling --> *(human; what each one works with. `Kit` checks this against the arsenal when a cycle opens and names the gap. Detailed technical contracts with a date and a source card — not here but in `project/config/CONFIG.md`, "Technical contracts of the environment" — this table holds only the tool name and one invariant line with a link to the anchor)*:

| Node   | Works with | In the arsenal |
| ---------- | ---------- | -------------- |
| `Intent` |  |  |
| `Spec`   |  |  |
| `Kit`    |  |  |
| `Run`    |  |  |

<!--
Example, illustrative — not a set value:
  Intent — a browser and search for research, screenshots for checking, a tool to show the image;
  Spec — a task board, a calendar, a timeline chart;
  Kit — access to the arsenal inventory and to formalized skills;
  Run — by the subject of the work.
The tools per node are chosen by the human, not by `Kit`: what to form the image with
is decided by whoever holds the image. `Kit` only checks and names the shortfall.
-->

**Project references** <!-- k:references --> *(human; what the result must conform to in all cycles)*:

Design system, glossary, standards, naming rules, API contracts, brand book. Only what tasks of **several** cycles refer to goes here; a one-off is declared in the cycle's `GOAL.md`.

| Reference | Where it lives | What it defines | Version today |
| -------------------- | ----------------- | --------------------------- | -------------------------------- |

<!--
A reference is neither a skill nor data.
A skill answers "how to do", a reference — "what to conform to",
data — "what to work with". Mixing these three is the most common corruption of a kit.
The version is fixed when a cycle opens and does not change within the cycle (prohibition 8):
a cycle closed on the second version cannot be judged by the third.
-->

**Access and data** *(human, before start; what exactly is available and where)*:

---

**What was missing — not here.** This field's setup is fixed (the rule is recorded, prohibition 5 of `AGENTS.md`): the field itself is filled by `Intent` each cycle in `JOURNAL.md` (the tail, not this table); a finding that needs fixing, not only recording, is a `.devtool/features/` card, epic "3. Form/Intent+Kit", label `what-was-missing`. `PROJECT.md` holds only this rule, not the findings themselves — otherwise the immutable settings file would turn into a growing journal.

---

## What goes into the cycle cache

From this file the cache takes: node tooling, thresholds, access and data, project references — by link and version. The result image arrives separately — from the current goal's `GOAL.md`.

Not included: "What was missing" (`JOURNAL.md` + cards of epic "3. Form/Intent+Kit") — that is material for `Spec` at slicing, not background for every call.
