# The Gauge

The measure between slicing and execution. One language for the five nodes; not a sixth node. Law — `AGENTS.md` §2 "The Gauge", prohibition 17.

## Why

`Spec`, `Kit` and `Run` read the same card in three dialects. The gap is paid for by `Run` (redone work) and by `Kit` (a kitting pass on every card). The Gauge reads the card once, against the catalog of `Run` roles, and says how well they fit — a number, not an opinion — so a fitting card goes straight to `Run`, and `Kit` is called only to create the role that is missing.

## What it answers

A decision model that writes no text and explains nothing. Three typed readings, mixed in one call:

| Reading | Question | Answer |
|---|---|---|
| choice | which role is closest | role, a probability for each role, confidence |
| score | how clearly the task is stated | 0–4, confidence |
| noul | does the leading role take this task | probability 0–1 |

## Who decides

`Spec`, by thresholds in `PROJECT.md` (leading probability, gap to the second, noul, clarity — separate per executor). The Gauge advises; it never confirms work (prohibition 1) and never replaces `Intent`'s check of the result.

| Reading | Goes to |
|---|---|
| fits | `Run`, role written into `## Kit` (`why: gauge`) |
| below threshold / small gap | `Kit` — creates the exact role, re-tested by the same call |
| low clarity | `Spec`, once — restate, never split to raise a percentage |

## Executors

Set by `gauge` in `PROJECT.md`. Default — the built-in small model (`gauge-haiku`), nothing leaves the model family. Recommended — an external decision model, behind the scrubbing script. A missing key, an error or a scrubbing refusal falls back to the built-in one, the reason goes into the card's history.

## Scrubbing (prohibition 17)

A script, not a model, fail-closed: only the five `## Task` fields; values from `VARS/` and `.env` replaced by their names; patterns (addresses, tokens, numbers, paths, IPs) masked; the site domain masked; a secret-like residue means no send. Personal data and secrets live only in `VARS/` and `.env` — never in a card.

## How a card travels

1. `Spec` slices; the card has its five `## Task` fields.
2. The scrubbing script builds the input from those fields only. Refused → in-family executor; secret-like residue → the card goes to the human.
3. The executor reads the scrubbed task and the role catalog (each profile's «takes / does not take») and returns `choice`, `score`, `noul`.
4. `Spec` compares with the thresholds, writes the role into `## Kit` or leaves it empty, and the call's spend line (with the reading) into `## History`.
5. Fits → `Run`. Below → `Kit` creates or corrects the role and re-tests it with the same call. Low clarity → `Spec` restates once.

## Settings (`PROJECT.md`, «Routes»)

| Setting | Meaning |
|---|---|
| `gauge` | executor: `haiku` (default, in-family) or `jev` (external decision model) |
| thresholds | leading probability, gap to the second, noul of the leader, clarity — separate per executor, revised by `Core` only through a stop with a report |
| external model | provider, model, key name in `.env`, the masked site domain, the cycle's call limit (in calls, never dollars) |

## Tools

| Tool | Does |
|---|---|
| `gauge-scrub.cjs` | scrubs a card's task; `--site` adds hosts to mask; exits 2 on a refusal; test: `gauge-scrub.test.cjs` |
| `gauge-measure.cjs` | `prepare` builds a batch from closed cards (role used = ground truth), `score` compares an executor's answers to it |
| `gauge-haiku` | the built-in executor, a subagent with the `Read` tool only |

An executor earns the right to decide alone only after a measurement on closed cards: the match with the role actually used, and the match at the confidence threshold, both recorded in `PROJECT.md`.

## For `Core`

Every reading is a line in the card's history. `Core` reads, per row, the share accepted first time: low clarity → `Spec`; role confidently named but kitted otherwise → `Kit`; role confirmed but the profile falls short → `Kit` corrects the profile; thresholds drifting → a stop with a report. The point is accuracy and less spend on misunderstanding between nodes — the share of spend on `Kit` should fall while the first-time share holds.
