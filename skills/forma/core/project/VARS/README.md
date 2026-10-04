# Decided values of the project

What was decided inside the work and became common to all goals: a name, a color, a format, a tone, an address, a unit of measure, test accounts. Each value lives **here and only here**; goals and cards refer to it as `[[name]]`.

Written by `Intent` when a goal closes. Revised by the human, as an event, not by an edit.

**`Kit` proposes candidates for a new value** — it is the main practical user of `VARS/`: kitting tasks, it is the first to hit a gap (`kit.md`, "Access credentials"). A proposal is a line in the card's history, not an edit of this file; deciding and writing is still only `Intent`'s, when a goal closes.

**This is a folder, not one file.** A project's list of values of different kinds — design-system numbers, test users, addresses — need not live in one table. Each file `VARS/<entity>.md` is one such table on its own subject, in the same format as below. This file (`VARS/README.md`) holds only the method: how to name, how to revise. Starting a new entity of values — a new file `VARS/<name>.md`, a line linking to it here, in the list below.

## Files of the folder

*Empty — the first file of values appears when something in the project is decided.*

---

## Format of one value (the same in all files of the folder)

| Name | Value | Decided in | Relied on by |
|---|---|---|---|
| `[[ ]]` | | goal-NN | |

<!--
Name — short and unambiguous, in Latin or any script, but the same everywhere.
"Decided in" — the goal where the value arose. Empty for those set by the human before the start.
"Relied on by" — the goals where it is used. Filled in as references appear.
-->

<!--
A value is not a reference and not data.

  Skill      — how to do           shaped by us
  Reference  — what to conform to  comes from outside
  Data       — what to work with   a task's input
  Value      — what is already decided  born in a goal

A reference came from outside and is not discussed. A value was decided by us — and therefore
it can be revised, but only knowing who relied on it.

`[[name]]` links are a plain markdown convention: they work in git, in grep and in any
editor that understands them. The protocol is not tied to an application.
-->

---

## Revision

Changing a decided value is **not an edit but an event**. The cause is usually one: the environment does not give what was recorded — `Spec` stopped and reported.

Order:

1. **Collect what is affected** — by the "Relied on by" column and by searching `[[name]]`. The list comes out mechanically, not from memory — that is what the column is kept for.
2. **Decide what to do with each affected goal:** revise, leave, reopen. Closed goals that stopped being true go back to `ROADMAP.md`, to the state `open`.
3. **Write the new value here** and the change in `JOURNAL.md`, section "Changed in infrastructure": what it was, what it became, why, who decided.
4. **References where this value is named get a new version.** Mockup, design system. The old version stays.
5. **What was made by the old value is marked** — in the composition reference, where the thing's composition is kept.
6. **What is marked is fixed by tooling tasks of the next circle**, not by redoing the current one. Otherwise the circle will never close.

**The wave does not go back through closed circles.** A closed folder is not rewritten: the divergence is carried forward by tasks, and it is visible. What is rewritten after the fact will not be visible.

Without the first step a value changes silently, and three goals later half the project rests on what no longer exists.

## The "Relied on by" column

Filled in with **the names of what will break**: pages, mockup sections, references. Not goal numbers — by a goal number you cannot find what to fix.

An empty column makes revision impossible: a value can be changed, but its consequences cannot be learned.
