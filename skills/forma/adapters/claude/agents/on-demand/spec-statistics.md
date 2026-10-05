# `Spec` — Statistics

Read this file when `Intent` calls you at the close of a goal for the `project/ops/VALUE.md` summary. Shared rules — `.claude/agents/spec.md`.

## Statistics

`Intent` calls you at the close of every goal (`.claude/agents/on-demand/intent-cycle-closing.md`/"After the verdict") — you total it up and write a line in `project/ops/VALUE.md`. Source: this goal's card histories and its `GOAL.md`, not an eyeballed estimate. Attempts (planned from slicing budgets / actual from histories) and tokens (`AGENTS.md`, section 3) are already counted and recorded there by the nodes that called each other — you sum, you don't recount: `Bash(node .forma/dashboard/tally.cjs *)` parses the spend lines and hands you the finished total, don't parse by hand. Key value — one sentence: what the project actually got, not a retelling of the cards. Not a retrospective assessment on your part — the same work you did all through the goal, for the last time before closing.
