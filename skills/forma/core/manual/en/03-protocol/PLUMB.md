# The Plumb

The measure between slicing and execution. One language for the five nodes; not a sixth node. Law — `AGENTS.md` §2 "The Plumb", prohibition 17.

## Why

`Spec`, `Kit` and `Run` read the same card in three dialects. The gap is paid for by `Run` (redone work) and by `Kit` (a kitting pass on every card). The Plumb reads the card once, against the catalog of `Run` roles, and says how well they fit — a number, not an opinion — so a fitting card goes straight to `Run`, and `Kit` is called only to create the role that is missing.

## What it answers

A decision model that writes no text and explains nothing. Three typed readings, mixed in one call:

| Reading | Question | Answer |
|---|---|---|
| choice | which role is closest | role, a probability for each role, confidence |
| score | how clearly the task is stated | 0–4, confidence |
| noul | does the leading role take this task | probability 0–1 |

## Who decides

`Spec`, by thresholds in `PROJECT.md` (leading probability, gap to the second, noul, clarity — separate per executor). The Plumb advises; it never confirms work (prohibition 1) and never replaces `Intent`'s check of the result.

| Reading | Goes to |
|---|---|
| fits | `Run`, role written into `## Kit` (`why: plumb`) |
| below threshold / small gap | `Kit` — creates the exact role, re-tested by the same call |
| low clarity | `Spec`, once — restate, never split to raise a percentage |

## Executors

Set by `plumb` in `PROJECT.md`. Default — the built-in small model (`plumb-haiku`), nothing leaves the model family. Recommended — an external decision model, behind the scrubbing script. A missing key, an error or a scrubbing refusal falls back to the built-in one, the reason goes into the card's history.

**`jev` (Claude Code).** The driver `plumb-run.cjs` scrubs the task and the role catalog, then calls the OpenRouter Decisions API (`typesafe/jev-1.14`) through the bridge: a typed `questions`+`state` request, not `chat/completions` — the model answers `choice`/`score`/`noul` directly, one call. On a missing key, a bridge error or a scrub refusal it prints a fallback marker instead of calling Jev; the caller then runs the built-in executor and records that attempt as such, the reason named — never as a `jev` reading that didn't happen. The one-time switch `plumb-switch.cjs` flips only the `plumb` selector in `PROJECT.md`; it stops without writing anything when the key is absent, and never sets the cycle's call limit or jev's own thresholds — the human sets both.

## Scrubbing (prohibition 17)

A script, not a model, fail-closed: only the five `## Task` fields; values from `VARS/` and `.env` replaced by their names; patterns (addresses, tokens, numbers, paths, IPs) masked; the site domain masked; a secret-like residue means no send. Personal data and secrets live only in `VARS/` and `.env` — never in a card.

## How a card travels

1. `Spec` slices; the card has its five `## Task` fields.
2. The scrubbing script builds the input from those fields only. Refused → in-family executor; secret-like residue → the card goes to the human.
3. The executor reads the scrubbed task and the role catalog (each profile's «takes / does not take») and returns `choice`, `score`, `noul`.
4. `Spec` compares with the thresholds, writes the role into `## Kit` or leaves it empty, and the call's spend line (with the reading) into `## History`.
5. Fits → `Run`. Below → `Kit` creates or corrects the role and re-tests it with the same call. Low clarity → `Spec` restates once.

## Measuring an executor

The script only prepares and scores; the engine's own executor does the reading, so any engine measures its own.

1. `node .claude/scripts/plumb-measure.cjs prepare <outDir>` — scrubbed tasks of closed cards (`batch.json`), the role catalog (`catalog.md`), the roles actually used (`truth.json`).
2. The engine's built-in executor gets `catalog.md` and `batch.json` in one batched call and returns, per card, `choice` (role, probabilities, confidence), `score` (clarity), `noul`. Saved as `results.json` (`[{id, choice, score, noul}]`).
3. `node .claude/scripts/plumb-measure.cjs score <outDir> results.json --executor <name>` — strict match, match at confidence ≥ 80, the misses.
4. Whoever measured reports the numbers to the human; thresholds per executor are set in `PROJECT.md` only on the human's decision.

## Settings (`PROJECT.md`, «Routes»)

| Setting | Meaning |
|---|---|
| `plumb` | executor: `haiku` (default, in-family) or `jev` (external decision model) |
| thresholds | leading probability, gap to the second, noul of the leader, clarity — separate per executor, revised by `Core` only through a stop with a report |
| external model | provider, model, key name in `.env`, the masked site domain, the cycle's call limit (in calls, never dollars) |

## Tools

| Tool | Does |
|---|---|
| `plumb-scrub.cjs` | scrubs a card's task; `--site` adds hosts to mask; exits 2 on a refusal; test: `plumb-scrub.test.cjs` |
| `plumb-measure.cjs` | `prepare` builds a batch from closed cards (role used = ground truth), `score` compares an executor's answers to it |
| `plumb-haiku` | the built-in executor, a subagent with the `Read` tool only |
| `plumb-run.cjs` | Claude Code's `jev` driver: scrub → OpenRouter Decisions API (`typesafe/jev-1.14`) via the bridge → `{choice, score, noul}`, or a fallback marker on a missing key / bridge error / scrub refusal |
| `plumb-switch.cjs` | flips the `plumb` selector in `PROJECT.md`; stops without writing when the key is absent; never sets the call limit or jev's thresholds |

An executor earns the right to decide alone only after a measurement on closed cards: the match with the role actually used, and the match at the confidence threshold, both recorded in `PROJECT.md`.

## For `Core`

Every reading is a line in the card's history. `Core` reads, per row, the share accepted first time: low clarity → `Spec`; role confidently named but kitted otherwise → `Kit`; role confirmed but the profile falls short → `Kit` corrects the profile; thresholds drifting → a stop with a report. The point is accuracy and less spend on misunderstanding between nodes — the share of spend on `Kit` should fall while the first-time share holds.

**The Plumb also runs a dup-check, not only the card.** Before `Kit` writes a new role, it runs the candidate shape (its «takes» line and 1–2 examples) through the same call against the catalog: at or above the executor's threshold on an existing role, that role is extended, not duplicated; below threshold, a new profile is written with an explicit «does not take» line naming the nearest neighbor (`kit.md`, "Every assembly leaves the catalog something"). This is also why `Kit` is now called inline on a missing role, never by opening a separate tooling card and making the task wait.

**Second metric: share of cards through `Kit`.** `node .forma/dashboard/tally.cjs .devtool/features` → `byNode.Kit.files` (cards carrying a `Kit` attempt) against `cardsWithAttempt` (every card with any recorded attempt). This share should fall as the catalog grows — a rising share with a flat catalog points at the dup-check being skipped, not at more work existing.
