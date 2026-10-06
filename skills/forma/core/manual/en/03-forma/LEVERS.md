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
| Handing a card to the next node (status/assignee + stage line + check) is done by hand, 3–4 turns | One call: `card-move.cjs <card> --to kit\|run\|intent\|accept\|close --note` | `board/card-move.cjs`, `kit.md`/`run.md`/`intent.md` | in place |
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

- **Turns per card handoff — measured.** Live run `node test/eval-start-context.cjs --scenario handoff --model sonnet --effort low`: a card in `backlog` is walked through three handoffs (Intent → Kit → Run → check), 3 runs each on `baedbfe` ("before", no `card-move`) and on `dev` ("after"). Turns: 20, 22, 20 → 18, 17, 15 (median 20 → 17, −15%); hand edits of the card file 7 → 1; cost per run $0.46 → $0.44 (−4%); all 6 runs finished the card. The effect is moderate: the agent spends about 15 turns in the scenario because it reads the role files and checks the protocol, not only because it moves fields — the manual editing went away, the reading stayed. Small sample (3 runs each), one model. Owner: `Intent`.
- **What to decide next from the measurement.** Most of a handoff's turns are reading roles and checking the protocol, so the next lever is moving the rare sections of `kit.md` and `run.md` to on-demand files and a batch `new-card` for `Spec`; decide both from a new measurement with the same scenario. The start-context lever stays `partial`. The `handoff` scenario satisfies the start gate (`AGENTS.md` section 3) itself and uses `route-7`: without that the agent rightly refuses to open a cycle or waits for the human's approval. Owner: `Intent`.

## Rule for new entries

1. Name the leak by its observable symptom (extra turns, repeated reads, rework), not by a guess at the cause.
2. Measure before and after with the spend lines (`tally.cjs`, by route or epic).
3. Record the lever where it lives, and change the state only after the measurement.
