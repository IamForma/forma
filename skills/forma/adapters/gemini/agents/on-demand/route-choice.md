# Route choice

Read this file only at the moment of choosing a route: `Intent` before the first call on a task, `Spec` while slicing a `route-8` segment. The law it serves — `AGENTS.md` §2 "Choosing the route", §6 route labels, §7 wave gate; what each route costs and why — `.forma/manual/en/03-forma/ROUTES.md` §3–§6. The project's settings — enabled routes, the `route-0` size limit, `over-2`/`over-4`, parallel `Run` per wave, the dispatcher, each epic's default route — are read from `project/config/PROJECT.md`, "Routes" (Russian: «Маршруты»). A route or overlay that section leaves disabled is not chosen, whatever the rule below gives: the next question answers instead.

## The rule

Seven questions, in order; the **first "yes"** is the route.

| № | Question | Route |
|---|---|---|
| 1 | The output is a question, not a delivery? | `route-3` — `Intent` → `Kit` gathers grounds → human decides |
| 2 | The work is shorter than its card (within the `route-0` limit in `PROJECT.md`)? | `route-0` — `Intent` itself |
| 3 | The whole volume of the goal is known and the image stable? | `route-8` — segments × waves; each segment card goes through questions 4–7 again |
| 4 | The error is expensive or invisible, the stack new, or the criterion not obvious? | `route-7` — `Spec` → `Kit` → `Run` → `Intent` |
| 5 | Slicing is needed and a kit for the kind is recorded? | `route-6` — `Spec` → `Run`, kit from the library              |
| 6 | The brief lies in an accepted document, or the card is routine and complete (five fields) with a ready `Run` profile? standard kit → | `route-2` — `Intent` → `Run` |
| | … a special role, access, skill or service → | `route-5` — `Intent` → `Kit` → `Run` |
| | … it is tooling of the engine or recon → | `route-4` — `Intent` → `Kit`, `Kit` executes |
| 7 | `Intent` understands the task best, and it is large? | `route-1` — a copy of `Intent`, given only the card |

No "yes" at all — `route-7`. Doubt between two — the longer one.

**The label binds the executor.** A card labelled `route-2`, `5`, `6` or `7` is executed by `Run`, never by `Intent` in its own session: a label with no call behind it is a route on paper (prohibitions 1 and 7). `Intent` that wants to do the work itself changes the label first — `route route-N → route-0 (why: <code>)` — within the `route-0` limit, or hands the card on. The board check `route-executor` reports a card in `review`/`done` on such a route with no `Run` attempt in its history.

**`route-2` with a ready profile (`why: ready`).** For a routine card — subject covered by a catalog profile (`.claude/agents/run/`), no recon needed — `Spec` writes the profile into `## Kit` (Role, Skill, Tool, Access, Data; Model inherited) while slicing, and `Intent` launches `Run` directly, without `Kit`. `Kit` joins only when a trial recon is needed or no profile fits (`route-5`).

**`Run` runs on `haiku` by default.** `Kit` only kits; a `Run` on a stronger tier (`sonnet` and up) needs an override with its reason in the card's history before the call (`kit.md`, "Task kitting"). `Intent` never raises the model without that line.

**Batches.** `Spec` slices several tasks per call. `Kit` kits 3–4 cards per call, at most 4. One agent per card remains only for different subjects or dependent cards (`after-card-*`). Spend: `AGENTS.md` §6, "Any reach to a subagent".

**Guard on `route-0`:** after several `route-0` in a row the next goes through `route-1` or `route-2` — clutter accumulates unseen.

## When, who, the dispatcher

- **When:** before the first call of any node on the task. A route chosen after the work began is a record, not a choice.
- **Who:** `Intent` on a single task (and chooses `route-8` or piecewise for a goal). On `route-8` choice is layered: `Spec` proposes each card's route while slicing, `Kit` refines it by the arsenal (kit ready or to be assembled; who executes), `Intent` approves the segment's route map as one decision and changes a card only with a reason in its history.
- **The dispatcher decides nothing.** Whoever mechanically launches the waves — a scripted workflow or `Intent` — neither reorders nor reassembles; a deviation from the plan goes back along the route (`AGENTS.md` §2).
- **Settings are not thresholds.** The route settings — which routes are enabled, the size limit of `route-0`, the batch of `over-4`, parallel `Run` per wave — are project configuration in `PROJECT.md`, "Routes", not thresholds of the law (`AGENTS.md` §3).
- **`Kit` may lengthen a route, never shorten it** past what the human approved; the change is a history line with its reason (`AGENTS.md` §2).

## Overlays

After the route, each independently; a second label, `over-N`:

| Condition | Overlay | Changes |
|---|---|---|
| a kit for the kind is recorded in `project/config/CONFIG.md` | `over-1` | the kit is taken by name |
| mechanics checked by fact ("was → becomes", a file); no judgment | `over-2` | executor — the external model (`external-model-bridge.cjs`) |
| N uniform tasks | `over-3` | one slicing and kit for N; the first card is `trial`, the rest start after its acceptance |
| a stream of small, cheap, reversible tasks under one criterion | `over-4` | acceptance — one per batch |

## Labels

Set in `labels` beside the goal label (`new-card.cjs --route N`); never as frontmatter keys — the board erases them.

| Label | How many | Set by |
|---|---|---|
| `route-N` (`route-0`…`route-8`) | exactly one | `Intent`; on a segment `Spec` |
| `over-N` (`over-1`…`over-4`) | zero or more | `Spec` or `Kit` |
| `seg-N` | one, `route-8` only | `Spec` |
| `wave-N` | one, `route-8` only | `Spec` |
| `after-card-NNN` | zero or more | `Spec` |
| `trial` | zero or one | `Spec` |

## Approval

`route-0`…`route-5`: the criterion is written by the one who accepts by it, so the human approves the five fields before the first call; until then the card stays in `backlog`. `route-6`…`route-8` need none. On `route-8` `Intent` approves the segment's route map in one decision (`GOAL.md`, "Segments"), not card by card.

## History lines

Key part in English; the description after the dash in the card's language (`AGENTS.md` §3, §6).

- Choice: `` `Intent`, YYYY-MM-DD: route route-N (why: <code>) — <причина>. `` (`Spec` on a segment card writes its own name.) Code — `human` · `ready` · `scale` · `risk` · `decision` · `tooling` (`AGENTS.md` §6). `ready`: the five fields and the kit are already set — the route goes straight to the executor.
- Change: `` `Kit`, YYYY-MM-DD: route route-2 → route-5 (why: <code>) — <причина>. ``
- Stage, on every move along the route: `` `Node`, YYYY-MM-DD: stage <key> — <что>. `` Keys `card` · `approve` · `kit` · `exec` · `check` · `accept` · `close`; the last line is where the card stands (`AGENTS.md` §6).
- Human approval (`route-0`…`route-5`): `` `Intent`, YYYY-MM-DD: human approved the five fields, 0 tokens, 0 s — <что одобрено>. `` No call id — nothing returned one.

The reason names which question answered "yes" and why — `Core` checks the choice by it.

**Cross-cutting:** a work item whose result is read by an agent, not a human, names the consumer and the form in its criterion. A card changing protocol files carries the template clause (`spec.md`, "Protocol files in the criterion").
