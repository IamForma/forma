# `Intent` · demo cycle

Read once, when the human said **start** to the offer (`intent-session-start.md`, 2b). Not kept loaded afterwards. A demonstration of the whole route on two small real cards, so the human sees what each node does and what it costs before the interview. It is the one exception to the start gate (`AGENTS.md` §3): the cards carry the label `demo`, stay out of the project's spend and statistics, and are removed at the end.

**Before anything:** `node .forma/i18n/cli.cjs demo done` — the marker is set at the start, so an interrupted demo is never offered a second time. Say in one line what is about to happen: two cards, a few minutes, nothing stays.

**Material.** One sentence from the human about what the project is (ask it if `project/brief/` and `PROJECT.md` give nothing; a project with a brief — take it from there and say so). The demo writes into `project/demo/` only; no project file outside it changes.

## The two cards

Created by the script, never by hand (`intent.md`, "Every request", item 2), epic "7. Production", both route-7 (`Spec` → `Kit` → `Run` → `Intent`; needs no approval):

```
node .forma/board/new-card.cjs --kind goal --demo --route 7 --why human --stage card \
  --title "Demo: one-page description" \
  --delivers "project/demo/about.md — what the project is, in three short sections" \
  --criterion "the file exists; exactly three `##` headings; at most 150 words; no `<…>` placeholders left" \
  --budget 2 --next "Intent checks the file, then the second card"
node .forma/board/new-card.cjs --kind goal --demo --route 7 --why human --stage card --after <NNN of the first> \
  --title "Demo: five first tasks" \
  --delivers "project/demo/first-tasks.md — five first tasks drawn from about.md" \
  --criterion "exactly five numbered items; each has a line starting `Criterion:` that can be checked by looking; no two items repeat each other" \
  --budget 2 --next "Intent checks the file; then Core"
```

The second card waits for the first (`after-card-NNN`, the wave gate, `AGENTS.md` §7). The cards go through the same machinery as any production card: `Spec` takes them from `backlog`, `Kit` writes the kit, `Run` executes, you check against the criterion by fact (open the file, count the headings and items). A failed check returns the card by the usual single channel — the demo does not hide a return, it shows one if it happens. Spend lines are written as always (`on-demand/spend-line.md`).

## The verdict

Both cards accepted: on the human's command (`AGENTS.md` §7 allows it before the volume threshold) hand the two cards to `Core` for the cycle verdict. It reads the cards as it would any cycle; the demo is the only place the human sees its output before a real cycle exists.

## The table

Then one table to the human, from the cards' own spend lines — nothing estimated:

`node .forma/dashboard/tally.cjs .devtool/features/done/<card-1>.md .devtool/features/done/<card-2>.md` (cards named explicitly are counted; the directory walk of the dashboard skips `demo`).

| Node | What it did | Attempts | Tokens | Time |
|---|---|---|---|---|

One line under it per node: what that node's work looked like here. Then, honestly: the demo is a miniature — a real card costs more in proportion to its size, and the table says nothing about the project.

## Clean-up

Ask once: **remove the demo** (recommended) or **keep it to look at**. Removing:

1. delete the two cards (`.devtool/features/**/<card-1>*.md`, `<card-2>*.md`) and `project/demo/`;
2. nothing else changes: the marker stays `done`, no goal, journal or roadmap line was written;
3. `node .forma/board/check-board.cjs` — the board is as empty as before.

Kept, the cards stay under their `demo` label and out of the spend; they are removed whenever the human says so.

**Then the real start:** the start gate is still closed — go on with the interview (`intent-session-start.md`, 2a).
