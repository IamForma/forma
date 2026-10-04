# The live interview picture — the file contract

The dashboard's "Interview" tab is drawn from `project/brief/picture.json`. `Intent` writes the file as the brief interview goes; the dashboard only reads it — and edits exactly one field, a guess's `status`, on the human's click.

**No file — no interview in progress.** This is not an error and not an empty stub: the tab says so. A broken JSON is shown separately from a missing one, because they are different things — in the second case there is no conversation, in the first it is going on and the picture is broken.

**Who writes, and when.** The picture is redrawn **per submitted round of answers**, not after every phrase. `Intent` rewrites the file whole once per round and raises `round`.

**Machine names stay canonical.** The five position names, the layer keys (`человек` / `предмет`) and the other keys below are the file's machine vocabulary: they are written exactly as given here, in every project language. Only the free text (`text`, `label`, `tag`, `topic`) follows the project language.

---

## File shape

```jsonc
{
  "topic": "brief interview for the project",
  "round": 2,                       // number of the last submitted round
  "updated": "2026-09-21T11:38:00+03:00",   // a real ISO timestamp, with zone
  "finished": null,                 // ISO, when the interview is closed

  "positions": [                    // the script's five positions (project/brief/interview.md)
    {
      "name": "Облик",              // strictly one of the five names, see below
      "state": "answered",          // only "answered" or "now" is written;
                                    // available/blocked/ready are derived, not stored
      "fill": 100,                  // 0-100; optional, 100 by default for answered
      "text": "Description of the product's look: key scenarios, audience…",
      "layers": {                   // positions 3 and 4 only
        "человек": { "text": "…" },
        "предмет": { "text": "…" }
      },
      "guess": {                    // optional — a guess for this position
        "id": "g-pos2",             // unique within the file; the click arrives by it
        "text": "The architect's guess, derived from the human's answers.",
        "status": "open"            // open | confirmed | rejected
      }
    }
  ],

  "tree": {                         // the subject tree; null until the first position is answered
    "id": "n-root",
    "label": "My project",
    "role": "root",                 // root | part | fn — what the node is to the tree
    "kind": "said",                 // said | guess | pending
    "tag": "project",               // caption to the right of the name; a guess sets its own
    "from": "position 1",           // where the node came from: "position N" or "round N"
    "fresh": false,                 // appeared in the last round — highlighted
    "status": "open",               // only for kind: "guess"
    "children": []
  }
}
```

## Questions: the first pass is open

**The agent invents the choice options.** A poll with ready-made options on the first pass would record in the brief the agent's idea approved by the human, instead of the human's idea recorded by the agent — and would bypass this picture's main decision unnoticed, because formally everything is "said by the human: they clicked".

Hence: **the first pass on a position is open** — a field for the human's words, no options. Options appear from the second pass and are built **from what has already been said** — to clarify, to break down, to finish. That way the poll spends effort on unfolding the thought, not on slipping in the thought itself.

**The conversation goes on the interview page** — the `forma-grill-with-ui` skill, a separate tab opened by the position's button. There is deliberately no form inside the dashboard: two places to enter answers to the same questions tire more than one familiar format the human gets used to. The dashboard shows, the page asks.

**Three layers, and they must not be confused.** The interview page is the transport (the session's `events.jsonl`). `project/brief/answers.jsonl` is the verbatim record of what was said, inside the brief, because the record of the conversation belongs to the project, not to the skill's session folder, which will be cleaned up one day. `picture.json` is `Intent`'s synthesis.

**The human's answers are stored verbatim and separately** — `project/brief/answers.jsonl`, one line per submission. The picture (`picture.json`) is `Intent`'s synthesis of them. Two files, not one, precisely because "said by the human" and "understood by the agent" must not lie in one place under one name.

## The starting round of position 1 "Облик" (Look)

Three questions, independent of each other: they go as one round, to be answered in any order and one at a time.

| | Question | What it draws out |
|---|---|---|
| **1** | The project already works. You show it to a person who knows nothing about it — you open it and let them look. What do they see in front of them? | The picture that is in the head anyway, instead of a definition. Objects fall out of it — blanks for the subject tree |
| **2** | Name one or two existing things this resembles. And at once — how yours differs from them | The comparison with the existing that `interview.md` directly requires. Naming the existing costs almost nothing; "how it differs" draws out what the project is made for. Goes into `brief/reference.md` |
| **3** | What in it should catch the eye first? And what, on the contrary, should be unnoticeable, go deeper? | A hierarchy, not a list: what is main, what is auxiliary. A bridge to the second position — parts already show through here |

**What the first question deliberately does not have.**

"What is your project about?" is a question that is almost impossible to answer badly and almost impossible to answer usefully: it draws out the mission, while position 1 requires a recognizable look, something that can be pointed at.

"What will a person feel in the first five seconds?" is the human layer of **position 3**. Asked first, it would give an answer about benefit, the look would stay unnamed, and the third position would then ask what has already been answered — and worse, without parts.

We do not ask for the human's name: addressing by name does not make the answer better, and the first question is too costly to spend on a form. The name will go into the "Date · who spoke" line of the interview record when needed.

**The rounds of the other positions are written when their turn comes**, together with the human — not composed in advance. A question composed before the previous answer is heard asks about an imaginary project.

---

## Order: a frontier, not a list

Positions open not in sequence but as the premises settle. The first and second are available at once — look and breakdown, neither waits for the other. The third waits for the second: the question "which common goal do the parts fulfill together" without named parts makes the human guess for what they have not said. The fourth waits for the third.

A position's state is **stored nowhere** — it is derived from the answers and dependencies at every build. A second record of it would drift from the first.

| State | What it means |
|---|---|
| `available` | the premises have settled, it can be answered |
| `blocked` | waits for a named position; visible and labeled with what it waits for |
| `now` | the human is answering right now |
| `answered` | the answer is recorded |
| `ready` | the fifth only: the first four are closed, the check is not done |

**A closed position is not hidden.** A hidden one would read as nonexistent, while a gray one labeled "waits for position 2" speaks both of the order and of what lies ahead.

## Two layers for positions 3 and 4

The **human** layer — what the recipient feels; the **subject** layer — which functionality produces it. One without the other degenerates: a feeling without functionality is a promise, functionality without a feeling is work for an unknown purpose.

In the file this is `layers` on the position: `{ "человек": { "text": "…" }, "предмет": { "text": "…" } }`. A position is closed when both layers are closed. For the conversation this means there are not five passes but seven, and each is smaller — which was the point of the split.

## The fifth position is not a question to the human

`Маршрут` (Route) is marked `asks: "intent"`, and it has no "answer" button. The route is the node's reconnaissance: the branch is set by the "Project template" field in `PROJECT.md`, and with a ready template `Intent` **checks** what is recorded in `ROUTE.md` rather than composing it anew. A button would call the human to do the node's work.

The human accepts or disputes the result of the check — with the same ✓ and ✗ as the guesses.

## Names on screen — from the side of the subject

`Облик` (Look), `Части` (Parts), `Общая цель частей` (The parts' common goal), `Внутренняя функциональность` (Internal functionality), `Маршрут` (Route). The internal names of the qualities — Beauty, Simplicity, Individuality, Honesty, Naturalness — are not put on screen: a question must not announce which quality it draws out, otherwise the human starts answering the category, not about their own project.

---

**A position that is not in the file is drawn empty, not dropped:** five positions are always five, otherwise it is not visible what has not been asked yet.

**`kind: "pending"`** is a placeholder branch "the functions wait for position 4". Not a guess: it has no author and no content, there is nothing to confirm in it.

---

## Three states of knowledge

The main decision here, and it is not about layout: **what the human said, what the agent guessed, and what is unknown to anyone are shown differently, and the third is not passed off as the second.**

| In the file | On screen | What it means |
|---|---|---|
| `kind: "said"` | solid outline | the human said this directly |
| `kind: "guess"`, `status: "open"` | dashed, label "being clarified" | the agent derived it from words; asked in the next round, not decided here |
| `kind: "guess"`, `status: "confirmed"` | — | not used: the human said it in the interview, so it is `said` |
| `kind: "guess"`, `status: "rejected"` | — | not used: the rejected does not get into the picture |
| `kind: "pending"` | dashed, gray | not asked about yet |

**A guess is marked per node, not by area** (Q4·C). Without this it becomes the human's decision unnoticed: they will see it on screen, it will look familiar, and they will not dispute it. The v1 prototype showed exactly this — it drew four parts convincingly although the human had not spoken about them.

---

## Where the unclear is settled

A guess is not an object demanding a decision but **a sign that the interview is not finished**. Seeing that something is not understood, `Intent` asks the next round and keeps asking until the human answers fully and clearly. The board shows the **result**, not a list of the unsettled.

Consequences:

- guesses must not accumulate in `picture.json`: what is still unclear is a question for the next round, not a node with a mark;
- a node not yet agreed on is marked "being clarified". This is **information, not an offer to decide**: it has no buttons;
- from the board there is a transition into the interview — "Open the interview". The only action the board offers about the unclear is to go and ask.

**Why the earlier rule was repealed.** Clicking a guess looked cheap — one movement instead of a conversation. But it closed the question **without asking it**: the human agreed with the agent's wording instead of saying it in their own words. The difference is visible in the first example — "tea" instead of the recognized "Desperate": confirmed by a click, that guess would have stayed my reading under their signature, not their word.

---

## How it ends

No guesses should remain by the interview's close: that is what the rounds are for — each becomes a question and gets an answer. What nevertheless stayed unasked goes into a **"not yet clarified" record beside the brief** — not into the brief itself and not into `ROUTE.md` (Q6·C, Q7·B).

Not into the brief because the brief is the anchor point and is not rewritten along the way: a supposition that settled in it reads a month later as the human's word, and **the eye stops seeing the mark**. Not into `ROUTE.md` because that holds fog about the route, while this is about the subject, and one would have to read it every other time asking "what is this about".

The rejected go nowhere: the human has already looked at them and said "no".
