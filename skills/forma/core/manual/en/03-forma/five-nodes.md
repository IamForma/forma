# Blueprint of the five nodes

Route diagram: `.forma/manual/en/assets/five-nodes.excalidraw` (plus a static `five-nodes-console.html`).

The full "what to do on deviation" table is not duplicated here — it is in `AGENTS.md`, sect. 1. Below is what was not yet available as a ready summary in `CLAUDE.md`/`SCHEME.md`/`PROTOCOL.md`.

## File ownership — verified by agent roles

| Node | Writes |
|---|---|
| Intent | brief/interview.md, brief/reference.md · GOAL.md · JOURNAL.md (the "what was missing" tail) · VARS/ · ROADMAP.md · card history — the check verdict |
| Spec | card — top (.devtool/features/) · card history — rework entries |
| Kit | card — bottom · card history — discrepancy and correction · .claude/skills/<name>/SKILL.md |
| Run | project/docs/ · .claude/scratch/ or .agents/scratch/ (depending on engine) |
| Core | GOAL.md — verdict, cycles table · PROJECT.md → "Thresholds" (only via a stop) |

## Revision 1

From the file ownership table (`.forma/manual/en/03-forma/SCHEME.md`, sect. 6), the row "CHECK.md | Intent, Core | never" was removed: it named only two of the four actual authors of the file. The roles `spec.md` and `kit.md` explicitly instruct them to write to `CHECK.md` themselves during rework and return — confirmed in `.forma/manual/en/03-forma/PROTOCOL.md`, section "Return as a separate work".

## Revision 2

The separate `CHECK.md` has been abolished. The task history moved into the card itself — as a third zone, alongside the top (`Spec`) and the bottom (`Kit`); `Spec`/`Kit`/`Intent` append to it, each with their own line at their own event. Reason: the card and its `CHECK.md` lived in different, unrelated directory trees (the board — flat by status, `CHECK.md` — nested by goal/cycle), and this was the only real reason for "searching in two places", not the mere fact of content separation. The only thing that was truly at the cycle level rather than the task level — the `Core` verdict — moved into the existing cycles table in `GOAL.md`, rather than remaining in a separate file.
