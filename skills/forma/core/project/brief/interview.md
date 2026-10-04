# Interview record

What the human said **before the first goal**. Collected by `Intent`, written from the human's words.

**Not rewritten along the way.** What is recorded here is the anchor point: it is used to check whether the idea has drifted. A measure that travels along with the results stops being a measure. If the intention changed — a new record below, with a date; the old one stays.

---

## The default script — five positions

**The script is in the core.** It is one for any project, with a template or without. A project template does not bring its own script: it puts a **reference into the fifth position** — a recorded route that `Intent` checks against.

It is run by the `grilling` skill (`grilling/SKILL.md` in the engine's skills directory), in rounds along the frontier of the decision tree, not as a single list and not one question at a time. The first four are questions to the human, **unnoticeable**: a question does not announce which quality it is reaching for, the human simply answers an ordinary conversational question (on the path of least action a direct question about the criterion cannot be answered objectively — `PROTOCOL.md`, "The path of least action").

**It is run on the skeleton `project/brief/idea.md`** (seven sections: Look, Composition, General goal, Functions, Route, Readiness criterion, Open questions). On each answer only the affected section is edited; the unconfirmed — with the mark *guess*, the unasked — *not yet asked*, a change to what was said — a line "changed per qN".

**The positions are read from the side of the subject, not of the speaker.** Not "what do you value" but "what does it consist of and what does it work for": the human answers about the project, not about themselves.

1. **Beauty** — **how it should look**: what the project is externally, what look it has.
2. **Simplicity** — **into which separate parts the project divides**: "it consists of this, this and this". Together with the first it gives a whole picture — the look plus the breakdown.
3. **Individuality** — **which one common goal all these parts fulfill together**: what benefit they bring jointly to a slice of the audience, which one task they work on. Two layers: what the human will **feel**, and by which functionality the project produces it.
4. **Sincerity, honesty, mission** — **which functions the project performs inside itself** in order to satisfy what was named in position 3: what internal functionality must exist in it. This is the very list of what `Run` will execute — the bricks the building is made of.
5. **Naturalness** (inevitability, harmony, fate — close in meaning for this same position) — **the route**: by what natural way all this is finally realized. Not a question to the human but `Intent`'s work — and the amount of this work depends on whether there is a project template.

### The fifth position — two branches, and their prices differ

The branch is set by the "Project template" field in `project/config/PROJECT.md`, not by a guess from which files exist.

| Template status | What `Intent` does at position 5 | Positions 1–4 |
|---|---|---|
| `verified ready` | **a check.** The route is recorded (`project/config/ROUTE.md`) — `Intent` does not compose it anew but clarifies **whether there are divergences** between what the human wants and what the template presumes. A divergence is named aloud, not smoothed over | in full, as usual |
| `forming with the human` | the same, but the route is incomplete: check against what is written, build what is missing | in full |
| `none` — unknown territory | **building.** There is nowhere to take a route from. `Intent` works out with the human what we do as the first step, the second, the third. **All five positions are worked through at equal depth**, the fifth on a par with the others | in full |

**Synthesizing a route that is already recorded is a mistake:** it is composing the decided anew and a divergence from the template out of nowhere.

**What a template does not shorten.** It fixes the **route**, not the content: what the project consists of, what for and what internal functionality it has — the human answers that, however many templates are installed. Exactly one position of the five is shortened.

The five is the first word of each of the "Five pairs" (`AGENTS.md` §1): beautifully (`Intent`), simply (`Spec`), individually (`Core`), honestly (`Run`), naturally (`Kit`). Unfolded here, before the first goal, it keeps all five nodes calibrated by the same human meaning of the word, not only by a formal criterion.

### What is understood by each position

Not what is asked of the human verbatim (the questions are unnoticeable, see above), but what `Intent` looks for in the answer and holds in the synthesis. Filled in by parts, one position at a time.

There are two optics, the essence is one: the **human** layer — what the recipient feels; the **subject** layer — which functionality produces it. One without the other degenerates: a feeling without functionality is a promise, functionality without a feeling is work for an unknown purpose.
>
> | Position | Human layer — what we ask | Subject layer — what we take out |
> |---|---|---|
> | **3. Individuality** | what benefit a **slice of the audience** receives: a person may not notice the benefit but **feel** that they received it | **which functionality the project must perform** and which effect to produce with it so that the person is satisfied |
> | **4. Honesty, mission** | what this is done for, care about what will come out | **which functions the project performs** to satisfy what was named in position 3 |
>
> **The human here is not the designer but the one the design is for.** "What this particular person personally gains" in the breakdown below is read as "a person from this slice of the audience", not "the one being interviewed". The individuality of the benefit is preserved: the benefit of a specific slice, not of the audience in general — otherwise the position degenerates into "no own" (`AGENTS.md` §1, `Core`'s loss).
>
> **Where this leads next.** The functions from position 4 are what `Run` executes: each task it closes is a brick of the building. Building a project, one must understand **which functions the whole building is made of** — and positions 3 and 4 give exactly this list, not a mood.
>
> The breakdowns below stay as they are: they are tied to the losses of the "Five pairs" nodes and work as a stock of branches for `grilling` — **how to get the human talking**. The short list at the start of the file says **what to take out** of an answer.

**1. Beauty.** Not abstract attractiveness ("make it beautiful") — a concrete, recognizable look of a thing: what can be pointed at, compared with another existing thing, not an abstraction without form. Unfolded through:

- **look, the physical image** — how it looks, what form it has;
- **structure and organization** — what it consists of, how it is arranged;
- **principle of action** — by what principle it works;
- **meaning** — what it means, what role it plays;
- **reason for existing** — what it is needed for, what justifies its being.

Recognizability is the core of the position: not "make it beautiful" in general, but something that can in some sense be touched, felt, realized as existing — and compared with another. Beauty that has lost recognizability degenerates into an abstraction — exactly how `Intent` loses its pair when it loses the form (`AGENTS.md` §1, "generalization").

*Possible `grilling` branches* — not a checklist to read out in a row but a stock in case root question 1 (`intent.md`, "Interview") does not open the facet by itself; asked only when the frontier has reached them:

- (structure/organization) "And what does it consist of, if taken apart?"
- (principle of action) "How does it work at all — if told step by step how it happens?"
- (meaning) "What does it mean for those who see it for the first time?"
- (reason for existing) "If it did not exist — what would then be missing?"

**2. Simplicity.** People do not want complexity: if a thing is complex, it is taken apart into simple parts until each becomes clear. Unfolded through:

- **a formulation in one phrase or word** — what to call it so that it is immediately clear;
- **breakdown into parts** — from a large, complex entity concrete, separate moments are singled out — what exactly it falls apart into;
- **audience segments** — for whom exactly it must be simple: there may be several segments, and for each its own simple explanation, not one for all;
- **clarity as a sign** — if simplicity is there, it is clear what it is and why it is needed; if there is no simplicity, there is no understanding either.

Simplicity that lost a part without sorting — not having decided what in that part is unimportant but simply having thrown it out — degenerates into omission: exactly how `Spec` loses its pair when it loses the form (`AGENTS.md` §1, "omission").

*Possible `grilling` branches* — a stock in case root question 2 does not open the facet by itself:

- (breakdown into parts) "If you had to explain it piece by piece — where would you start, and what would come next?"
- (audience segments) "To whom will it be clear at once, and to whom will it take longer to explain?"
- (clarity as a sign) "How will you know that a person really understood, and did not just nod?"

**3. Individuality.** Not the external form (that is "Beauty", item 1) — the inner content: what this particular person gains for themselves, not the audience in general. Unfolded through:

- **personal benefit** — what exactly the person gets for themselves, what benefit or gain it gives them;
- **inner content** — not how it looks but what it is filled with from inside;
- **personal value** — what definite value and importance it carries personally for them — not the project's mission in general (the general mission is part of item 4) but what they in particular find in it;
- **inner harmony** — the happiness, balance, harmony a person finds in themselves through this thing — a personal need, not an external reason;
- **distinctiveness** — nobody wants to be like others, everyone wants to be special: how it makes the one who uses it unlike the rest, different.

Individuality that lost each person's personal gain and turned into something common to all, without sorting out who actually needs it, degenerates into having none of its own — exactly how `Core` loses its pair when it loses the form (`AGENTS.md` §1, "no own").

*Possible `grilling` branches* — a stock in case root question 3 does not open the facet by itself:

- (personal benefit) "What will you personally get when this works?"
- (distinctiveness) "How will it differ from what everyone already has?"
- (inner harmony) "When it works out — what will you feel first of all?"

**4. Sincerity, honesty, mission.** No person can achieve anything alone — such is human nature: they need the wholeness of an environment, a community that brings people closer and unites them around a common mission. Unfolded through:

- **honesty without a false bottom** — no catch, deceit, hidden meaning: what is seen is what is;
- **care for the community** — not for oneself alone but for those nearby: how a person can interact with others, share experience, look after them;
- **togetherness of the result** — what cannot be achieved separately: the result comes only jointly, not alone;
- **what it gives** — warmth, support, hope, backing, love — what a person cannot do without, because they cannot come to be alone.

Honesty that became a catch or a hidden intent degenerates into substitution — exactly how `Run` loses its pair when it loses the form (`AGENTS.md` §1, "substitution").

*Possible `grilling` branches* — a stock in case root question 4 does not open the facet by itself:

- (care for the community) "Who besides you will gain from it — and what exactly will they get?"
- (togetherness of the result) "What here cannot be done alone, only together with others?"
- (what it gives) "What will a person feel getting this from you — support, warmth, something else?"

**5. Naturalness (inevitability, harmony, fate).** Not what integrates and synchronizes itself out of the first four — `Intent`'s active work: a lawful grounding, not faith that everything will work. If beauty (1), simplicity (2), individuality (3) and honesty-mission (4) rest on fantasy and not on a confirmable ground, they will lead nowhere — they stay outside real, human and physical laws. Unfolded through:

- **lawful grounding, not faith** — what here is scientific, right from the point of view of science, law, established order — what really makes the previous four realizable and not merely desired;
- **confirmability** — not an abstraction and not a fantasy: what can be confirmed by experience, knowledge, facts — by common sense and sound reasoning, not by faith in the result;
- **law, not choice** — this is how it works and cannot work otherwise — like the law of gravity, like the law of thermodynamics;
- **technology, not intention** — the very essence of the method that works for us, not what we want it to work like;
- **a sense of inevitability** — "and it could not have been otherwise" — a consequence of a confirmed ground, not the ground itself: the feeling comes last, not first, and is not a grounding by itself.

This is not an item that gets obtained by itself or arises passively — it must be unfolded exactly like the first four, only not by a question to the human but by `Intent`'s own reconnaissance: law, science, established order — a fact from the environment, not the human's choice, and `Intent` scouts it itself, does not ask (`grilling/SKILL.md`, "Facts are your work, not a question to the human"). It is checked only after the first four are already known — not because then it "joins up by itself" but because until that moment there is nothing to ground: the law has nothing to relate to until beauty, simplicity, individuality and mission themselves exist.

Naturalness taken on faith or extracted directly by a question to the human, rather than confirmed by `Intent` with law, science and experience, is no longer law but fitting to what is wished: distortion, exactly how `Kit` loses its pair when it loses the form (`AGENTS.md` §1, "distortion").

The verbatim wordings of questions 1–4 and of synthesis 5 are in `intent.md`, "Interview"; what is recorded here is the result, not the conversation itself.

---

## Date · who spoke

### 1. Beauty

<!-- Unnoticeable question 1 of the script above. What caught, where the gaze or thought lingered. -->

### 2. Simplicity

<!-- Unnoticeable question 2. One phrase or word, without explanations for an outsider. -->

### 3. Individuality

<!-- Unnoticeable question 3. Personal motivation — why it matters to this very person. -->

### 4. Sincerity, honesty, mission

<!-- Unnoticeable question 4. The needed actions and care about what comes out in the end. -->

### 5. Naturalness (`Intent`'s reconnaissance)

<!-- Not a question to the human and not a passive consequence of the first four — `Intent`'s active reconnaissance, from answers 1–4 and the reference:
     - arrival criterion — by which sign two independent parties recognize that they arrived;
     - references — named things with an address, in brief/reference.md, not here;
     - natural path — which skills/laws/order/knowledge/experience are needed for it to happen "as if by itself" — it goes on into GOAL.md.
     The draft synthesis is taken to the human for confirmation. See intent.md, "Interview". -->

---

## What the human brought

<!-- A list: templates, exports, access, samples. The files themselves — in materials/. -->

## What stayed unclear

<!-- Questions to which there is no answer yet. Their presence is not a failure: it is
     what will have to be named as a gap before slicing. -->
