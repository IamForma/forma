# Economy contract

One contract for every engine. The core counts; an engine adapter only extracts. Math — `.forma/dashboard/economy.cjs`; conformance test — `node .forma/dashboard/economy.test.cjs`.

## Canonical variables

| Variable | Meaning | Unit | Required | `unknown` |
|---|---|---|---|---|
| `tokens_in` | uncached input of the call | tokens | per call, transcript | — |
| `tokens_out` | model output | tokens | per call, transcript | — |
| `cache_read` | input read from cache (R) | tokens | yes on a card line | `(cache-read unknown)` |
| `cache_write` | input written into cache | tokens | per call, transcript | — |
| `duration_s` | call duration (T) | whole seconds | yes on a card line | `unknown s` |
| `call_id` | id of that one call; session id for main-session work | string | yes on a card line | `` `id unknown` `` |
| `tool_uses` | tool reaches of the call | count | no | — |
| `ext_units` | paid external service, its own unit | `N <unit> (service/operation)` | when used | — |

A card line records the total **N = tokens_in + cache_write + cache_read + tokens_out**; work = N − R. A per-call split lives in the transcript, not in the card.

## Three states of a field

- number — recorded;
- `unknown` marker — the engine did not return it, the node named it: counted **separately**, never as 0;
- absent — the line predates the rule: not counted at all.

## Line skeleton (card `## History`, `AGENTS.md` §3)

`` `Node`, YYYY-MM-DD: attempt, N tokens (R cache-read), T s[, $X (provider/model)][, N <unit> (service/op)], `<call_id>` — <engine>: <what was done>. ``

The engine tag after the dash is the grouping key. Tokens of different engine tags are never summed; engines are compared only by shared fields — attempts, time, accepted cards.

## Who writes the line, and where

- **Who:** the caller, right after the return — never the node itself, never after the fact. **Where:** the card's `## History`.
- **Spend is counted by fact, not by impression.** A node doesn't know its own spend from inside — that knowledge is in the call's metadata, not in its context. **Field names:** which field of the engine's return fills which variable of the skeleton — §8 of the engine file; read, never estimated.

## The key part is English; the engine opens the description

- **Language.** The key part — everything before the dash: `attempt`, `tokens`, `cache-read`, `s`, the markers, the external-model and external-service segments — is written **in English, in every project, whatever its language**; the description after the dash is in the card's language (`AGENTS.md` §6). The key part is what the counters parse: one encoding keeps them reading every project the same. Lines written earlier in another language stay as they are (prohibition 5) and are still read; a new one written so is reported by `sync-engines --check`.
- **Engine.** The description after the dash **opens with the engine that did the work** — `claude-code:`, `codex:`, `gemini:` — so a card shows who executed it and who left its spend unrecorded.

## T, R and the call id

- **T:** the call's duration in whole seconds.
- **R:** the call's cache-read counter, read straight from the call's own result, no separate call. R is almost always fixed overhead (loading these rules and the role), not the work itself; it isn't split finer, because nothing inside one call separates card content from the work proper without adding another call.
- **Call id:** the identifier of that one call, read straight from the call's own result like the numbers beside it — never composed, never guessed. Which field of the return carries it is named in §8 of the engine file, like every other spend field. It stands **last in the spend block, immediately before the dash**, after any external-model or external-service segment: the numbers stay where the eye already looks for them, and the opaque token sits where the eye passes over it into the prose. **No separate call — the session id**: work done inside the shared session takes its numbers and its id from the engine's transcript of that session (see "`Intent` in the shared session" below).
- **A continuation of the same `Run` (`AGENTS.md` §2) reuses that call's id on purpose.** `Kit` sending a written correction to a live call is still one call, read and recorded the same way as any other — the line marks itself `attempt (continuation)` so two lines sharing one `call_id` on the same card read as one call extended, not as a duplicate or a mistake.

## The `unknown` marker

The engine did not return the number at all: the line is still written in full, with a **marker in the field's place** — `(cache-read unknown)` instead of `(R cache-read)`, `` `id unknown` `` instead of the identifier. Two conditions, both binding: the marker goes in **only after an attempt to take the number from the call's own transcript** (the reading is named in §8 of the engine file, next to the spend fields themselves), and the **reason is named in the prose after the dash**. The marker is not a licence to skip the reading, and never a substitute for a number the call did return.

**What the engine never returned is written as a fact, not left as a hole.** Estimating by eye is forbidden and an off-form line drops out of the sum silently: the marker keeps the line lawful and the gap **counted separately** — reported as its own quantity ("unknown: N attempts"), never as zero.

## External model and external service

- **External model.** The calling node writes its own line and inserts `$X.XXXXXX (provider/model)` before the dash. The sole exception to "the caller writes it"; it doesn't violate prohibition 1. Mechanics — `run-external-model.md`, `kit-graphs.md`.
- **External service.** A paid service reached through MCP or an API — image generation, 3D, speech — is charged in **its own unit**, not in tokens and not in dollars. The node inserts `N <unit> (service/operation)` before the dash, one segment per service touched: `` 1160 credits (image-service/upscale) ``. The number is read from the call's own answer, like any other spend — never estimated from a price list. Which services are connected, in what unit each charges and where its number is read — `PROJECT.md`, "External services".

## `Intent` in the shared session

Work `Intent` does inside the shared session — executing a card itself, checking, orchestrating the nodes — is counted **from the engine's transcript of the main session** and written into the card as an ordinary spend line: N, R and T read by the engine's script (§8), the session id in place of the call id, subagent answers excluded (they are already in `## History`). Each answer belongs to one card only. Written by the engine that did the work, before the card's commit. **`0 tokens` is an exception, not the default:** allowed only when the transcript could not be read or holds nothing for the card, written with the markers of "The `unknown` marker" (`unknown tokens (cache-read unknown)`, `` `id unknown` ``) and the reason after the dash. An event that is no work — the human's approval, a status change — is an event line without `attempt` (`AGENTS.md` §6). Invoked as a subagent instead — the caller writes the line on the general terms. The article **"`Intent` ↔ human"** stays as the whole-dialog ledger and overlaps these lines; routes are compared by the card lines, never by adding the two.

## What the checks require

- **R and T are not optional.** A line lacking either is reported by `sync-engines --check` (from the day the rule entered the project, `.forma/living/checks.json`; earlier lines stay as they are, prohibition 5). A call's metadata does not outlive the call, so an unwritten spend cannot be recovered.
- **The call id stitches the card to the tool journal** — one shared field makes kitting by kind of task readable. It is checked only forward: required of lines dated later than the day the field entered the project (`.forma/living/checks.json`), since the id does not outlive its call.

## Adapter duty

Each engine's §8 — or the on-demand file it points to — names which of its return fields map to which variable and how R is read. Its line must pass the conformance test.
