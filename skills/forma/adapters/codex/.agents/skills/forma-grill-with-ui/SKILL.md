---
name: forma-grill-with-ui
description: Grilling-интервью на локальной странице браузера вместо терминала: все вопросы с рекомендациями разом, ответ в любом порядке, обсуждение по каждому, одна кнопка «Send to Agent». Запуск — «forma/форма grill with ui» или /forma-grill-with-ui <тема>; продолжение — /forma-grill-with-ui resume.
---

# grill-with-ui

Форк `grill-with-ui` (jasonku09) под протокол «Форма» — собственная зафиксированная копия, не апстрим (исходник — `UPSTREAM-README.md`).

`$SKILL` below means this skill's base directory (the folder holding this file). Everything is
plain Node with no install step: `node $SKILL/server.mjs <command>`.

Two files carry a grill. `state.json` is **yours alone**: questions, recommendations, thread
replies, statuses, agent status. `events.jsonl` is **the page's alone**: one line per Send.
Nobody writes the other's file. The page polls `state.json`; you are woken per event line.
A third file, `visual.html`, is also yours, drawn by a subagent you run (see Visualize).

## Start (`/grill-with-ui <topic>`, `$grill-with-ui <topic>`, or "grill with ui: <topic>")

1. From the project directory run
   `node $SKILL/server.mjs new --topic "<topic>" --doc "<doc path>"`.
   The doc path defaults to `docs/<slug-of-topic>-design.md` under the project root (create the
   folder later if needed). It prints one JSON line; keep `session` (the session folder).
2. Write round 1 into `<session>/state.json` (schema at the end): one to three independent
   questions, each with lettered options, one recommendation, and a one-paragraph why. Set
   `agent.status` to `"waiting"` and `agent.since` to now.
3. Open a **persistent background watcher** (a tool that runs a command and wakes you on each line it prints) whose command is
   `node $SKILL/server.mjs serve --session <session>`, description `grill page: <topic>`.
   No such watcher in your harness? Use
   "Wait mode" at the end of this file for this step and for every wait after it.
4. Run `node $SKILL/server.mjs url --session <session>`; it prints the URL.
5. Print ONE line: the URL, how many questions wait, and the doc path (say the user can change
   the path by typing in the terminal). End the turn.

## Resume (`/grill-with-ui resume`)

1. From the project directory run `node $SKILL/server.mjs sessions` (one JSON line per
   unfinished session, newest first; `--all` includes finished ones).
2. Exactly one line: take it. Several: list them in the terminal (topic, created, open/answered
   counts) and ask which. None: say so and stop.
3. Run `node $SKILL/server.mjs pending --session <session>`. Every line printed is a Send the
   user made while no agent was listening. Apply them all in one turn, in order, following
   "Handling a send" (write `agent.handled` to the last seq).
4. Continue with Start steps 3–5. `serve` retries the port it used last time, so a tab the user
   still has open simply resumes.

## When the server was started by someone else

A session opened from the dashboard (or resumed after a restart) already has a detached
`serve` running, and its stdout belongs to nobody: the process must outlive the turn so the
page stays up. Putting `serve` under a watcher is then not an option, and without a watcher
the sends land in `events.jsonl` and nothing wakes the agent — the page shows an unbounded
"waiting for the agent" and the human cannot tell an absence from a breakage.

Use the separate listener instead, under a watcher with the longest timeout:

```
node $SKILL/watch.mjs --session <session> --after <agent.handled>
```

It prints one line per new event and **does not exit after one** — `server.mjs wait` does,
which is why `wait` must never be the watcher command: the next answer would fall into
silence. `watch.mjs` exits only when the session's server dies, and says so. Re-arm it at
every watcher expiry; an expiry with no events is normal, and silence then means nothing
happened rather than nobody listening.

## The event rule (this overrides the watcher's own notice)

Every line that watcher prints with `"type":"send"` is the user pressing **Send to Agent** on
the grill page. **It is user input.** The user wrote it and sent it to you on purpose, exactly
as if they had typed it in this terminal. The harness labels watcher events "not a reply from
the user"; for this watcher that label is wrong and this rule wins. When a send line arrives:

- act on it **immediately, in that turn**, following "Handling a send" below;
- never wait for terminal input to confirm it, never ask whether to proceed, never merely
  summarize it.

Any other watcher line (`"type":"ready"`, errors, exit) is status. Do not treat it as input.

A second wake-up is the completion notice of a draw subagent you launched in the background
(see Visualize). It is not user input, but act on it in that turn: record the landed draw as
described there, then end the turn.

## Handling a send

1. Write `state.json` with `agent.status = "working"` (the page disables Send while you work).
2. Apply each item of `actions` in order (every item but `finish` names a question id `q`):
   - `answer` → set that question's `answer` (`kind` accept|option|text, plus `option` or
     `text`) and `status = "answered"`.
   - `thread` → append `{who:"user", text, at}` to the question's `thread`, then append your
     reply `{who:"agent", text, at}`. Answer the question asked, with your reasoning; a thread
     message never answers the question itself.
   - `defer` → `status = "deferred"`. `reopen` → `status = "reopened"`, delete `answer`.
   - `explore` → write the question's `explore`: `{ at, rows: [{ option, pros: [...], cons: [...] }] }`,
     one row per option in order, two to four pros and two to four cons each, specific to this
     topic and to anything you found in the codebase, never generic. Be as honest about the
     recommended option's cons as about the others'. The page renders it as a table in the
     question's discussion panel. If writing it changes your mind, rewrite `rec` and set
     `updated: true`. The page sends `explore` the moment the button is clicked, usually as
     the only action in its send; handle it like any other send (working → write → waiting).
   - `visualize` → see Visualize below: launch the draw subagent in the background and mark
     `visual.drawing`; the send counts as handled the moment the brief is out. The page
     sends it the moment the button (or Regenerate) is clicked, usually alone.
   - `visual-feedback` → append `{who:"user", text, at}` to `visual.thread`, reply there
     `{who:"agent", text, at}`, and request a redraw with the change (see Visualize; while a
     draw is in flight the note goes to `visual.queued` instead of starting a second one).
     If the note contradicts an **answered** question, do not change that answer:
     set the question's `status = "reopened"`, quote the note in its `thread`, rewrite its
     `rec` to what the note implies, set `updated: true`. The answer changes only when the
     user answers the reopened question. The visual follows the note either way.
   - `finish` → see Finish below, after the other actions. The page sends it the moment the
     user confirms, with everything they had staged in front of it.
3. If an answer changes the recommendation of a still-open question, rewrite that question's
   `rec` in place and set `updated: true` (the page marks it). Clear `updated` once the user
   answers it.
3a. Update three files on every send, only the parts this send touched; unconfirmed —
   *догадка*, a change to what was said — line «изменено по qN»:
   - `project/brief/idea.md` — the interview skeleton;
   - `project/brief/picture.json` → `tree` — node `{id, kind: said|guess|pending, label,
     from: "qN", role, children: []}`; `said` = the human said it, `guess` = yours, `pending`
     = branch not yet asked;
   - `project/brief/landing-prompt.md` — the first-page prompt: engagement scenario,
     sections, style, texts; unchecked — *догадка*.
4. Add the next round: the frontier (see Interview method), up to three when independent,
   each with `deps` listing the question ids it depends on. New questions get the next round
   number. If the tree is fully walked, add no questions and set `note` to a short sentence
   saying every branch is settled and Finish is the next step.
5. **Ordinary turns do not redraw the visual.** When an answer, reopen, or changed
   recommendation affects what an existing visual shows, set `visual.stale = true`.
   Leave `visual.html`, `version`, `at`, and `note` unchanged; the page marks it out of date
   and the user can click **Regenerate** when ready. Do not launch a draw subagent merely
   because the next round is ready. Explicit `visualize` and `visual-feedback` actions
   still request a draw, and Finish still reconciles the exported visual.
6. Write `state.json` with `agent.status = "waiting"`, `agent.since = now`,
   `agent.handled = <seq of this send>`. Publish the answer/thread updates, next round,
   and this acknowledgement together in the same whole-file write. Do not publish the
   next round with an old `handled` value while doing optional work: the page uses
   `handled` to clear the previous question's "sent" spinner and enable the next Send.
7. Print exactly one terminal line, e.g.
   `grill: handled send #3 (Q2 → B, Q4 thread); round 4 has 2 questions; visual v3 out of date`,
   and end the turn.

## Interview method (frontier per round)

Interview the user relentlessly about every aspect of the topic until you share an
understanding, walking each branch of the design tree and resolving dependencies between
decisions in order:

- A question is asked only when its prerequisites are settled. Each round is the current
  **frontier**: the questions that can be asked now. Ask up to three per round when they are
  independent of each other; one when they are not. Record each question's `deps`.
- Every question has a `title`, a `body` that states what hangs on it, lettered `options`
  (two to four), and `rec` with the recommended option and a one-paragraph `why` that names
  the trade-off. A question with no sensible options has `options: []` and `rec.text`.
- If a question can be answered by exploring the codebase or the docs, explore instead of
  asking, and mention what you found in the next question's body.
- Maintain `terms` as vocabulary settles: `term`, one-sentence `def`, and `avoid` (words
  not to use for it). Use the terms consistently in later questions.
- Set `durable: true` on a question whose decision passes all three gates: hard to reverse,
  surprising without context, a real trade-off. Everything else is a routine choice.
- Stop asking when the tree is walked. Say so with `note`; do not pad with filler questions.

## Visualize

The header's **Visualize** button asks for one artifact for the whole grill, the **visual**:
a **prototype** when the topic is a user interface (a page, a panel, a flow the user clicks
through), a **diagram** otherwise (architecture, data flow, sequence, state). Decide from the
topic and the questions so far; say which in `visual.kind`; switch when feedback asks
("make this a diagram"). Questions are the source of truth and the visual is derived from
them, never the other way round. When the topic is an improvement or a feature in an
existing app, the prototype is drawn **in the context of that app**: the real page it lands
on, with the app's own chrome and styling, so it looks like what will actually ship. You
know where it lands from the grill; tell the subagent.

**You never write `visual.html` yourself; a subagent draws it.** The file runs to hundreds
of lines and is redrawn many times over a grill. Drawing it here would fill this session's
context with markup and slow every later send. You stay the interviewer: you pick the kind,
write the brief, and record the result in `state.json`. The rules for the file itself live
in `$SKILL/visual-brief.md`; the subagent reads them, you do not repeat them.

Draw only for the first Visualize click, Regenerate, explicit visual feedback, or the
Finish reconcile. A requested redraw brings the visual up to date with **all** current
questions, including changes accumulated since its last version, not just the triggering
send. Ordinary interview turns only mark an affected visual stale.

Every requested draw goes like this. **The draw runs in the background and the interview
goes on**: the send that requested it is handled the moment the brief is out, so the user
keeps answering and sending while the subagent draws.

1. Launch ONE subagent with your subagent tool (it runs in the background and you get a
   completion notice later), general-purpose type, prompt filled in from this template
   (use the absolute path of `$SKILL`):

   > Draw the visual for a grill-with-ui design interview. Read `$SKILL/visual-brief.md`
   > first and follow it exactly. Session folder: `<session>`. Project root: `<project>`.
   > Kind: **prototype** | **diagram**.
   > Context: **change to an existing app**, landing in `<route, page, or component>`;
   > match that page's real look and surroundings. | **New UI**, nothing to match. |
   > **Diagram of existing code** in `<modules>`. | **Diagram of a new system**.
   > **First cut** from the questions in `state.json`.
   > — or —
   > **Redraw** of the existing `visual.html`. Change only what follows; keep everything
   > else stable:
   > - Q3 answered B: the discussion panel moves to the right third
   > - feedback: "make the sidebar collapsible"
   > Write `<session>/visual.html` and reply with ONE line saying what the visual now
   > shows (or what changed).

   One send with several triggers (feedback plus answers that change the visual) is one
   draw with all of them in the list.
2. In the same turn write `state.json`. On a first draw create
   `visual = { kind, version: 0, thread: [], stale: false, drawing: { since: now, seq } }`.
   On a redraw keep `version`, `at`, `note`, and the file as they are and set
   `stale = false` and `drawing = { since: now, seq }`. Then finish the send as usual
   (`agent.handled = seq`, `agent.status = "waiting"`), print the terminal line with
   "visual drawing" in it, and end the turn. The page reads `drawing`: on a first draw it
   stays on the questions with the header button reading Visualizing… and flips to the
   visual by itself when v1 lands; on a redraw it keeps the current version on screen with
   regenerating… in the strip. Send stays enabled throughout.
3. **While a draw is in flight**, handle sends normally. An answer, reopen, or changed
   recommendation that affects the visual sets `stale = true` as usual (the in-flight
   draw did not see it). A new draw request (Visualize, Regenerate, or visual feedback)
   does not start a second subagent: reply in the thread now and append the request as
   one bullet to `visual.queued`. Never run two draws at once; both would write the same
   file.
4. **When the draw lands** (its completion notice wakes you): confirm
   `<session>/visual.html` exists and is newer than `drawing.since` (stat it; do not read
   it). Bump `version` (0 → 1 on a first draw), set `at`, set `note` to one line naming
   what changed, taken from the subagent's reply ("v3: discussion panel moved to the right
   per Q3"), delete `drawing`, and leave `stale` as it is. If `visual.queued` is
   non-empty, launch the next draw at once with those bullets as the change list (steps
   1–2 again, `drawing.seq` = the last handled seq) and delete `queued`. Write
   `state.json`, print one line ("grill: visual v3 landed", or "… landed; drawing v4 from
   2 queued notes"), and end the turn. Never bump without a new file and never let a new
   file land without a bump; the page reloads the iframe only on a bump.
5. If the subagent fails or the file did not change: on a first draw delete `visual`
   entirely and set `note` (the sentence above the question list) to say the draw failed
   and Visualize can be clicked again; on a redraw delete `drawing` and append one
   `{who:"agent"}` message to `visual.thread` saying so. Do not bump either way.

Background draws rely on your being the top-level session: a subagent's own background
tasks are dropped when its turn ends. If you are yourself running as a subagent, or your
harness has no subagent tool, draw the file yourself from `visual-brief.md`, inline, then
bump the version in the same turn as the rest of the send.

Feedback arrives as `visual-feedback` actions (see Handling a send); sending visual feedback
explicitly requests a redraw. Answers and question discussions do not. On Finish the visual
is reconciled with the decisions and copied next to the doc.

## Terminal input

Text the user types in the terminal during a grill answers the current question when that is
unambiguous (one open question, or the text names one): record it into `state.json` exactly as
a page send would (`answer.kind = "text"`, or `option` when it is a letter), then continue as
in "Handling a send" from step 3. Otherwise ask which question it answers, in one line. The
doc path may also be changed this way ("write the doc to …").

## Finish

On a `finish` action, or when the user says finish in the terminal:

1. Write the design doc to `doc` (relative to the project root). It is exhaustive and
   self-contained, in this order: a one-paragraph summary (linking the visual at
   `docs/<slug>-visual.html` when there is one, see step 3); **Terms** (each with its
   Avoid list); **Why** (the problem in the user's words); **Locked decisions** (every
   `durable` question: the decision, the rejected options and why each lost); **Routine
   choices** (every other answered question, one bullet each); **Verified facts** (anything
   you established by exploring rather than asking, if any); **Risks**; **Deferred**
   (deferred questions, with what would reopen them); **Open threads** (discussion points
   that ended without a decision); then the five **Form axes** below, in this fixed order.
   Do not compress: a reader with no access to the session must be able to build from it.

   **Section headers follow the project's language** (same rule as `AGENTS.md` §6 already
   sets for task cards — check `project/config/PROJECT.md`, "Язык проекта"). All thirteen sections
   get translated, not only the five Form axes below; nothing above is skipped or renamed to
   English when the project language isn't English. For a Russian-language project, use:
   Terms → Термины · Why → Почему · Locked decisions → Закреплённые решения · Routine
   choices → Рутинные решения · Verified facts → Проверенные факты · Risks → Риски ·
   Deferred → Отложено · Open threads → Открытые нити · Beauty → Красота · Simplicity →
   Простота · Individuality → Индивидуальность · Honesty → Честность · Naturalness →
   Естественность.

   **Form axes — five sections synthesized across the whole interview, not copied from any
   single question.** Fixed order (this is how a person's attention naturally moves — see it,
   then grasp what it does, then its worth, then the doing, then what makes it inevitable),
   one short paragraph each, drawing on whichever answers actually bear on it (a question
   rarely maps to exactly one axis):
   - **Beauty — what the solution looks like.** The form, the shape, the felt impression it
     leaves — literal appearance for a UI topic, felt clarity/coherence of structure for a
     process or system topic.
   - **Simplicity — what the solution does.** Its function stripped to the essential, in
     plain terms, without the how or the why.
   - **Individuality — what benefit it brings.** The specific worth this solution delivers
     here, what it is for, what would be missing without it.
   - **Honesty — what has to be done to get it.** The real, unglossed scope of action
     required — the doing, not the wishing.
   - **Naturalness — what has to be known for it to happen this way and no other.**
     Knowledge that, once complete (the right tools, the right place, the right facts
     already in hand), collapses the outcome into the only one now possible — not one
     answer among several, but the one nothing else could have been. When a question is
     still open, reopened, or deferred, this axis is written from its recommendation and
     marked assumed, the same way an undecided region is marked in a visual (see
     `visual-brief.md`).
2. Write `state.json` with `finished = { doc, at }` and `agent.status = "waiting"`; the page
   shows the finished banner and locks staging.
3. If `state.visual` exists, it must be reconciled with every answered question before it
   is exported. If no draw is in flight and it is not stale and nothing disagrees, copy
   `<session>/visual.html` to `docs/<slug>-visual.html` next to the doc (same folder, same
   slug, `-visual.html`) and set `finished.visual` to that path. Otherwise request one
   reconciling draw (or let the in-flight one land), end the turn, and when it lands copy
   the file and set `finished.visual` then.
3b. Reconcile `idea.md`, `picture.json` → `tree` and `landing-prompt.md` with **every**
   answer: nothing said is missing, nothing contradicts; a guess the answers settled loses
   its mark.
4. Stop the watcher, once there is no draw in flight.
5. Print one line with the doc path (and the visual's). End.

## Wait mode (agents without a background watcher)

Start the server detached with its output going to a log:
`nohup node $SKILL/server.mjs serve --session <session> > <session>/serve.log 2>&1 &`, then
run `url` as in Start. Instead of a watcher, loop in the foreground:
`node $SKILL/server.mjs wait --session <session> --after <agent.handled> --timeout 480`.
It prints the next send line and exits 0, or exits 3 on timeout (re-issue it). Handle each
printed line exactly as in "Handling a send". On finish, kill the server by the `pid` in
`<session>/server.json`.

## state.json

```jsonc
{
  "topic": "…", "doc": "docs/x-design.md", "project": "/abs/path", "created": "ISO",
  "agent": { "status": "waiting|working", "since": "ISO", "handled": 3 },
  "note": "optional short sentence shown above the question list",
  "finished": { "doc": "docs/x-design.md", "visual": "docs/x-visual.html", "at": "ISO" },  // only after Finish
  "visual": {                                                   // only after a visualize action
    "kind": "prototype|diagram", "version": 3, "at": "ISO",
    "note": "v3: discussion panel moved to the right per Q3",
    "stale": false,                                            // true after relevant ordinary decisions; no redraw or version bump
    "drawing": { "since": "ISO", "seq": 12 },                  // while a draw subagent runs; version is 0 before the first lands
    "queued": ["feedback: make the sidebar collapsible"],      // draw requests that arrived during a draw; next draw takes them
    "thread": [{ "who": "user|agent", "text": "…", "at": "ISO" }]
  },
  "terms": [{ "term": "…", "def": "…", "avoid": ["…"] }],
  "questions": [{
    "id": "q7", "round": 4, "deps": ["q2"], "title": "…", "body": "…",
    "options": [{ "k": "A", "text": "…" }],
    "rec": { "option": "A", "why": "…" },                       // or { "text": "…", "why": "…" }
    "status": "open|answered|deferred|reopened", "durable": false, "updated": false,
    "answer": { "kind": "accept|option|text", "option": "A", "text": "…" },
    "explore": { "at": "ISO", "rows": [{ "option": "A", "pros": ["…"], "cons": ["…"] }] },  // after an explore action
    "thread": [{ "who": "user|agent", "text": "…", "at": "ISO" }]
  }]
}
```

Send lines (`events.jsonl`, also printed by `serve`):

```jsonc
{ "type": "send", "seq": 12, "at": "ISO", "session": "/abs/session/folder", "actions": [
  { "q": "q15", "type": "answer", "kind": "accept|option|text", "option": "A", "text": "…" },
  { "q": "q8",  "type": "thread", "text": "…" },
  { "q": "q17", "type": "defer" }, { "q": "q3", "type": "reopen" }, { "q": "q9", "type": "explore" },
  { "type": "visualize" }, { "type": "visual-feedback", "text": "…" },
  { "type": "finish" } ] }
```
