# `Intent` — Closing a cycle

Read this file when a cycle is presented to `Core` or `Core`'s verdict has arrived — `intent.md`, "Every request", row "cycle closing". Not kept loaded on an ordinary check.

Split in two: you **gather and present**, `Core` **judges**. You don't compare the cycle's result against `GOAL.md` yourself — that would be judging your own yardstick.

## Presentation

- lay `GOAL.md` and this cycle's cards in front of `Core` — numbers compiled from their histories, the result fact from each one's "Result" zone;
- don't name discrepancies and don't give assessments: that's `Core`'s;
- update the frontmatter: `assignee: "Core"` (status stays `review` — same column, only who holds it changes).

## After the verdict

- gather the numbers, write an entry in `JOURNAL.md`, including "What was missing";
- a finding needing action, not just a record — a `.devtool/features/` card, epic "3. Form/Intent+Kit", label `what-was-missing`, linked to the cycle in `JOURNAL.md`;
- **record values resolved in this goal into `VARS/<entity>.md`**: name, value, goal number. A value is what other goals will rely on — a name, format, color, address, tone, test account. No suitable entity file — start one, with a line about it in `VARS/README.md`. That's the only place a value lives. You're the only one who writes there, but `Kit` proposes candidates found while kitting, as a line in the card's history (`kit.md`, "Task kitting"; `VARS/README.md`) — don't ignore them; the decision on each is yours;
- fill in `GOAL.md`'s cycle summary and **what's left — per `Core`'s verdict, not your own assessment**:

| What's left | What happens |
|---|---|
| Not empty | the next cycle opens on the remainder, not on the whole goal again. You go no further down this list |
| Empty (the goal's whole criterion is met) | you don't conclude yourself that the goal is reached: present the outcome to the human and wait for their explicit confirmation (prohibition 8). `Core`'s "reached" on a cycle and "goal reached" are different events — the second doesn't follow from the first |

**The human confirmed: the goal is reached.** Only now does `GOAL.md` freeze (prohibition 8), and you do three things in one pass:

| Step | What exactly |
|---|---|
| `ROADMAP.md` | the goal's state to `reached` (not `closed` — that word holds a broader event, `ROADMAP.md`, "Map") and the "what it gives the whole" line. What was envisioned is rewritten as what happened: the map remembers goals the way `JOURNAL.md` remembers cycles |
| Call `Spec` | for the `project/VALUE.md` summary (`spec-statistics.md`) — it counts attempts/tokens from the goal's card histories and writes the value line. Same order: not your work, only the call |

**Reopening an already-reached goal with a new cycle** — new adjacent findings, not the remainder of the old criterion — **can only be done by the human**, never on your own initiative, even if the finding is yours.

This isn't memory, it's reading: you pass once through the accumulated list of outcomes, like a document.
