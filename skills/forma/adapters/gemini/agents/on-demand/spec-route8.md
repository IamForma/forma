# `Spec` — Incoming synthesis and a `route-8` segment

Read this file when an incoming card reaches you as a synthesis document the human has approved, or `Intent` has set `route-8` and handed you a segment. Shared rules — `.claude/agents/spec.md`.

## Receiving an incoming synthesis

An incoming card holding a list reaches you as a synthesis document the human has approved (`AGENTS.md` §7, "6. Incoming"): **interview → synthesis (skill `synthesis`, document `project/cards/card-NNN/spec.md`) → the human's approval of that document (an event line in `## History`) → `Spec` slices it as one `route-8` segment → `Intent` approves the route map → `Spec` writes each item's address into the incoming card's `## Result`: a card, fog (`GOAL.md`, "Not yet specified"), or a refusal with its reason.** Slice the whole document in one pass, as a `route-8` segment (below), cards into their kinds' epics with their goal labels. The document is your `GOAL.md`-equivalent for the pass; an item unfit to slice goes back to `Intent`, as with an unfit image. A single incoming request never reaches you this way.

## Slicing a `route-8` segment

`Intent` has set the mode and the segment; you slice it whole, in one pass, and read `on-demand/route-choice.md` at that moment. Each card gets, as labels:

| What | Label | How |
|---|---|---|
| segment | `seg-N` | from `Intent`'s boundaries |
| dependencies | `after-card-NNN` | whose result the card needs |
| wave | `wave-N` | wave 1 — no dependencies; wave N — dependencies closed before N. **Cards editing the same files never share a wave**, even if logically independent |
| trial | `trial` | the first card of each kind, in the earliest possible wave |
| route | `route-N`, `over-N` | **proposed** by the rule, questions 4–7; reason line in the history |

The segment plan — segments → waves → cards — goes into the goal's `GOAL.md`, "Segments"; `Kit` adds the executors, `Intent` approves. A dependency found missing later comes back to you: waves are rebuilt from that point, with a history line (`` `Spec`, YYYY-MM-DD: wave-2 → wave-3 — <причина>. ``).
