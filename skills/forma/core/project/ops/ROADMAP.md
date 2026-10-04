# Project roadmap

What we build and in what order. The shape of the whole — here; what we work with and at what level — in `PROJECT.md`.

**The shape is drawn by the human.** A goal's state is set by `Intent` when the human confirms the goal is reached.

---

## The whole

<!--
In one line: what thing is being built. Not a task, a subject.
For example: "The Forma site — a platform for the entrepreneurs' track".
-->

## The map

A map node is a goal. The first level is nine main goals by kind (`goal-<code>`), all running in parallel; under them subgoals `goal-NN` with continuous numbers. Nesting shows what the whole consists of and sets the subgoal's kind (`sync-engines` reads it from here). The number and the state stand in the line.

```
<The whole>
├── goal-value · Value open
├── goal-docs · Documentation open
├── goal-forma · Form open
├── goal-result-image · Result image open
├── goal-core · Balance open
├── goal-incoming · Incoming open
├── goal-goal · Production open
│   └── goal-01 · <name of a part of the product> not started
├── goal-experience · Experience open
└── goal-review-image · Review image open
```

State: `not started` · `open` · `reached` · `closed` · `postponed`.

**Two different words for two different events, do not confuse them.** `reached` — the local state of one goal: the whole criterion of the goal is met across all cycles of the series, and the human has explicitly confirmed it (`AGENTS.md`, prohibition 8) — not automatically on `Core`'s "reached" verdict alone at the level of a single cycle inside `GOAL.md`. `closed` — a different, wider event, the decision about which (per goal or all at once for the whole project) is made by the human separately and recorded here too. A goal not yet confirmed by the human stays `open` even if its criterion is met by cycles — "reached" on a cycle ≠ goal "reached". Only the human can reopen an already `reached` goal with a new cycle.

## Links besides nesting

When a goal depends not on its parent but on a neighbor from another branch.

| Goal | Waits for | What exactly it waits for |
|---|---|---|
| | | |

## What closed goals gave

Filled in by `Intent` on closing. **What was intended is rewritten into what happened** — the difference between these two records is what the project learned.

| Goal | What it gives the whole |
|---|---|
| | |

---

<!--
Goal folders lie flat: `goals/goal-01-<name>/`, no nesting.
The shape is held by this map, not by the file system: nested folders make paths
long and reordering nodes expensive. The map is rewritten in a minute,
the directory tree is not.
-->
