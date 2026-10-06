# Levers: what makes the work efficient, and where resource leaks

A living register. Each lever is a mechanism that cuts spend (tokens, turns, time) or raises quality; each **leak** is a place where resource is lost. Spend is measured by fact (`ECONOMY.md`), so a lever is judged by the trend, not by impression. Add a row when a lever is found; mark a leak closed only once its lever is in place.

Clean zone: no card codes, dates or project names here (`AGENTS.md`, prohibition 16). The history of each finding lives in cards and the changelog.

## How to read

| Column | Meaning |
|---|---|
| Leak | where resource is lost |
| Lever | what closes or shrinks it |
| Where | the file, script or rule that carries it |
| State | `in place` · `partial` · `open` |

## Register

| Leak | Lever | Where | State |
|---|---|---|---|
| A card is created empty, then edited in several turns (task fields, route reason, stage line) | Create it complete in one call: `--delivers --criterion --budget --next --why --why-detail --stage` | `board/new-card.cjs` | in place |
| Handing a card to the next node (status/assignee + stage line + check) is done by hand, 3–4 turns | One call: `card-move.cjs <card> --to kit\|run\|intent\|accept\|close --note` | `board/card-move.cjs`, `kit.md`/`run.md`/`intent.md` | partial |
| Number, epic name, goal label looked up and typed by hand | The script takes them from `PROJECT.md` and the board | `board/new-card.cjs` | in place |
| A broken card is found late, at a commit or a cycle check | The board check runs on the card at creation and on every write | `new-card.cjs` (step 6), `check-card.sh` hook | in place |
| Role files loaded in full on every request | Rare rules moved to on-demand files, read at the moment they apply | `agents/on-demand/` | in place |
| Full route for work that does not need it | Nine routes; the cheapest one that fits, chosen by the rule | `ROUTES.md`, `route-choice.md` | in place |
| A fresh `Run` rebuilt for a local execution slip | Continue the same `Run` with a written correction (counts as an attempt) | `AGENTS.md` §2 | in place |
| Spend estimated by impression | Spend line from the call's own metadata, written by the caller | `ECONOMY.md`, `AGENTS.md` §3 | in place |
| Context at session start grows unnoticed | Live eval of start context, before/after | `test/eval-start-context.cjs` | partial |
| A repeated task re-solved from scratch each time | Skills for repeatable steps; project knowledge written to `project/` once | `SKILLS.md`, skill `project-knowledge` | partial |
| Same diagnosis repeated across reassemblies | Second identical diagnosis is a stop, not another attempt | `AGENTS.md` prohibition 14 | in place |

## Open leaks (to investigate)

List here what is suspected but not yet measured or closed: write the symptom, how to measure it (which spend lines or `tally.cjs` cut), and who owns it. Do not add a lever before the leak is measured.

- **Turns per card handoff.** Before: 3–4 calls per handoff (read the card, edit `status`/`assignee`, append the stage line, board check); after: 1 (`card-move.cjs`). Counted from the role procedures, not from live sessions. Metric: `K turns` in the spend line of the call that hands the card over, and `tally.cjs --routes` (turns column) per route/epic. Flip the register row to `in place` once live cards show handoff turns converging to 1; owner: `Intent`.
- **Turn measurement — pending.** Run `node test/eval-start-context.cjs --scenario card --model sonnet --effort low` on `dev` ("after") and on commit `baedbfe` ("before"), same `--model` and `--effort`; record `K turns`, tokens, $ here. Until measured, the handoff and start-context levers stay `partial`; a batch `new-card` for `Spec` and on-demand sections of `kit.md` are decided by its result; owner is `Intent`.

## Rule for new entries

1. Name the leak by its observable symptom (extra turns, repeated reads, rework), not by a guess at the cause.
2. Measure before and after with the spend lines (`tally.cjs`, by route or epic).
3. Record the lever where it lives, and change the state only after the measurement.
