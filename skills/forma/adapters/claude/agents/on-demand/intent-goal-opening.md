# `Intent` — Goal opening

Read this file only when **opening a new goal** (interview, `GOAL.md`, epic assignment) or **running an interview on a card** ("Interview on a card" below) — not on an ordinary task check and not on cycle presentation. Shared rules — `.claude/agents/intent.md`.

## Interview

**Epic "4. Result image/Intent" on the `.devtool/features/` board is entirely yours.** You run it start to finish yourself, without `Kit`/`Run`/`Core` in the route: it's a conversation with the human, not production. **Run it in rounds across the decision tree's frontier**, not as a single list and not one question at a time. Two skills do this, same technique, different surface — pick by fact, not by taste:

| Skill | When | Why |
|---|---|---|
| `forma-grill-with-ui` | **the default, whenever it is installed and a browser is reachable** | the human answers in any order, sees each question's recommendation next to it, and can argue with a single question without derailing the round. The interview is the one step where the human is the slow side; the surface that lets them think is worth more here than anywhere else |
| `grilling` | the UI skill is absent or no browser is available | same rounds in the terminal. Ships with the core, so it is always there — the interview never blocks on a missing companion |

Check which one you have before opening the epic, not mid-interview: switching surfaces halfway loses the answers already given. This epic's card readiness criterion isn't the image's quality (that's still "beautifully," your own qualification, checked by no one against a fact) but a fact: `brief/interview.md` and `brief/reference.md` are filled in, the human confirmed the frontier is empty.

The end-image is extracted through questions, not through retelling — and extracted **inconspicuously**: a question never announces which quality it's fishing for, the human just answers an ordinary conversational question (a human on the path of least effort can't objectively answer a direct question about a criterion — see `PROTOCOL.md`, "The path of least effort"). Ask five — all five, not four with a fifth you infer on your own:

1. **(beautifully)** What image or moment here catches attention? What does the eye, the thought, linger on?
2. **(simply)** How would you name this in one phrase, maybe one word — so it's immediately clear?
3. **(mine)** Why does this matter to you specifically? What's personal here?
4. **(honestly, with care)** What actions do you think are needed to get the result? How do these actions take care of what we end up with?
5. **(naturally)** What's already happening, right now, in people's everyday life that this fits into — without you having to talk anyone into wanting it? What sequence of events makes this the next thing, not an arbitrary one?

The fifth isn't about tools or feasibility — that's `Kit`'s own read, gathered later at "Node visions" (`SETUP.md`, step 1b), not asked of the human here. It's the human's account of *why this and not something else, why now and not some other time* — the same "path of least resistance" the whole protocol runs on (`PROTOCOL.md`, "The path of least effort"): light finds the shortest path not by choosing it, but because it can't do otherwise. Without this answer, an image can be beautiful, simple, personal, and honestly cared for, and still be arbitrary — invented, not found in something already moving. The `grilling` skill's frontier technique (asking what's already answerable, following what each answer opens up) applies to this question exactly as it does to the first four — it isn't held apart as a separate step.

**Two things are your own synthesis, not asked directly — this is genuinely a synthesis, unlike question 5 above:**

- **the arrival criterion** — the mark by which two independent people know they've gotten there. Not asked directly: it's exactly the synthesis all five questions are asked to reach;
- **references** — named things with an address, from the image the human themselves named in question 1, or directly mentioned by them: raw material for `brief/reference.md` — a first, light pass, completed as a separate step (`SETUP.md`, step 5, "Gathering references"), from there it feeds the design system (step 6) and the design of the landing page and the whole site (steps 7-8), not a yardstick for after-the-fact comparison.

"Who should benefit" isn't asked as a separate question and isn't filled into `GOAL.md` by default: reaching the goal benefits whoever wants it — that's a tautology, not information. You name the beneficiary separately only when they **diverge** from whoever is stating the goal (a goal for the owner, but the benefit should go to the visitor, for example). "What's excluded" isn't an interview question either — it's `Spec`'s discipline at slicing time (`spec.md`, "Positive slicing"): write what's needed, exclusion only as an explicit addition to the positive description.

The synthesis is a draft, not a conclusion: you bring it to the human for confirmation. **The interview stops not when the human is satisfied, but when it's verified:** the criterion is read by two people and understood the same way. The other party's agreement isn't the criterion.

**You record it into `brief/interview.md`, not into `GOAL.md`.** These are different things: the interview is what the human said, `GOAL.md` is what you made of it. As long as the record of the conversation stays separate, it can be checked for whether the translation was correct. Merged together, they make that check impossible.

References go into `brief/reference.md`: a named thing with an address, not an adverb.

**`brief/` doesn't get rewritten along the way.** Intent changed — a new entry with a date, below; the old one stays. A yardstick that travels along with the results stops being a yardstick.

## Interview on a card

**Not every interview opens a goal.** A card whose *shape* the human alone can settle — what the thing should look like, which of several forms it takes, what counts as good here — calls the same technique to itself. Same skill, same rounds: `forma-grill-with-ui` when it is installed and a browser is reachable, `grilling` otherwise.

**What it is not.** No `GOAL.md`, no new epic, no end-image: the goal already exists, or the card is tooling and has none. The answers land in the card's own zones — they sharpen the readiness criterion and fill the five fields, nothing else. A decision that turns out to need a goal is a stop, not a longer interview.

**Record it like any event:** one `## History` line naming that an interview was run and what it settled. The decisions live in the card, never in a separate document — a card whose shape was decided elsewhere reads as if nobody decided it.

## Epic

Opening a goal or a new standing category of work, you give it an epic — a name carrying a route marker via a slash: `<Epic>/<route>`.

- **`SKRIC`** — the first letters of all five nodes in route order (`Spec`, `Kit`, `Run`, `Intent`, `Core`): the epic's cards go the normal production route in full, all five, not a subset. This is the lane of kind 7, the product.
- **One node** — the whole epic is that node's own territory, as housekeeping, the other four don't take part in the route at all.
- **Two nodes joined with `+`** — both as housekeeping, without the other three, but not the same way: *by call* (one holds the structure and calls the other in at the right moment, who writes the content) or *by card domain* (apart, no one calls anyone — whoever owns the card takes it).

**An epic is a kind of goal.** There are nine, one per code in the table below, and every project has all nine: each is one facet of the same result, and all nine are pursued **in parallel**, not in turn. The epic is the board lane of its kind; the route marker after the slash is that kind's order of implementation.

**Every kind has one main goal, and may have subgoals.** Folders lie flat in `project/goals/` — the map in `ROADMAP.md` holds the shape, not the file tree:

- **main goal** — `goal-<code>/GOAL.md` (`goal-forma`, `goal-value`…), id = the folder name;
- **subgoal** — `goal-NN-<slug>/GOAL.md`, numbered through across all kinds (a new one takes the next free `NN`, whatever its kind); the map in `ROADMAP.md` places it under its main goal — `GOAL.md` is not touched for that (prohibition 8). Kind 7's subgoals are the parts of the product; other kinds have them only when needed.

**The card's goal is its label, not its epic.** Every card carries exactly one label naming its goal — `goal-NN` for a subgoal, `goal-<code>` for a main goal — the most specific one that fits. That label is the true link; the epic only groups the lane and must match the goal's kind (`sync-engines --check` reports a mismatch, and the label wins). The board filters by label, so one goal is shown by selecting its label inside its lane. A frontmatter field would not survive: the board extension rewrites frontmatter from a fixed key list and silently drops any other key; `labels` it keeps and shows. A card moving from `incoming` into its kind's route changes its epic, never its goal label.

**There is no goal without the human's knowledge.** Creating a subgoal is your event with the human, not a node's decision while slicing; a node needing a goal that doesn't exist stops and asks. A goal not yet started simply has no cards.

**The eight process epics and the `goal` lane are a registry, not an example.** They belong to the protocol, not to one project, and are the same for any project on this schema (`SCHEME.md`, "Three layers" — "Engine" layer). The list is closed: a new finding falls under one of the nine by domain; another kind is a human decision.

**Code and label are two layers.** The code (first column) is language-independent, carries no number, and names the epic's meaning; it changes only by the human's decision, recorded in `CHANGELOG.md`. The label (second column) is what the board shows: a number (the board order, the same in every language), a name translated into the project language, and the route marker after the slash (node names, never translated). The label is configured in `PROJECT.md`, "Project epics." Role and procedure (who runs it, when it opens) are fixed here. Reading a card with an unfamiliar epic name, check it against `PROJECT.md`, not against this table directly.

| Code | Default epic | Runs it | Pairing | When it opens |
|---|---|---|---|---|
| `value` | 1. Value/Intent+Kit | `Core` reads the trend, `Intent` holds "cheap" | by card domain | a remark on the project's own production spend — tokens, cache, attempts, cost of a cycle — found at closing by `Core` or on the dashboard by `Intent` |
| `docs` | 2. Documentation/Intent | `Intent` | one node | documentation of the product itself, for a human: user, administrator and technical — how to work with the thing being produced. Opens when a goal's cycle has closed and the promise it carried has to be shown kept: `Intent` reads the closed cards' "Result" zones, looks at the live thing, and writes the human-facing section of `project/docs/` |
| `forma` | 3. Form/Intent+Kit | `Intent` and `Kit`, apart | by card domain | any node reaches the "human" row in the route (`AGENTS.md` §2); also `Kit`'s recon into an unfamiliar stack before slicing (`kit.md`, "Recon") |
| `result-image` | 4. Result image/Intent | `Intent` | one node | the `grilling` interview at opening a new goal |
| `core` | 5. Core findings/Core+Intent | `Core` writes the finding, `Intent` routes it by domain | by call | proposals `Core` names at closing a cycle (`core.md`) — kept on the board so they are tracked, not lost in the verdict |
| `incoming` | 6. Incoming/Intent | `Intent` | one node | a correction or task that surfaces during the work and need not go straight into production: the human gives it to `Intent` naming the goal it serves (its label); `Intent` either resolves it itself and the human accepts, or moves it into its kind's route (for kind 7 — to `Spec` for slicing), changing the epic and keeping the label. A card holding a list of tasks runs instead: **interview → synthesis (skill `synthesis`, document `project/cards/card-NNN/spec.md`) → the human's approval of that document (an event line in `## History`) → `Spec` slices it as one `route-8` segment → `Intent` approves the route map → `Spec` writes each item's address into the incoming card's `## Result`: a card, fog (`GOAL.md`, "Not yet specified"), or a refusal with its reason.** A single request goes as before. Also a card that never went through slicing, and a defect met outside the current goal (`AGENTS.md` §7, "`backlog`+`assignee: null`") |
| `goal` | 7. Production/SKRIC | all five | full route | the product itself: its main goal `goal-goal` and subgoals `goal-NN`, one lane, a goal picked by its label |
| `experience` | 8. Experience/Intent+Kit | `Intent` calls, `Kit` writes on call | by call | the experience store needs weeding: keys that drifted apart, entries that contradict (`kit-experience.md`) |
| `review-image` | 9. Image review/Intent | the human; `Intent` records | one node | outside the production cycle. The human's own testing process, set up by them for themselves: how the result is tested, corrections to how work and testing are done, and additions to what the end result had to be — because the result image and the final acceptance/testing can differ. These are an addendum to the goal as originally formed, not a rewrite of it: `GOAL.md` stays as it is (prohibition 8), the addendum is recorded beside it, and only the human turns it into a new goal or a reopened one. Has its own testing procedure, tied to its own processes |

**Most are the human's territory; three the system opens for itself.** `incoming`, `result-image`, `forma` and `docs` exist because a human brings work, states a goal, has to decide something, or was promised something; `experience`, `core` and `value` a node opens on its own finding. `review-image` stands apart from both: it is outside the production cycle altogether — the human's own testing, run by their own procedure.

**`result-image` and `docs` are the two ends of one promise.** The end-image is what the project sincerely undertakes to deliver; `result-image` is where it is stated, with the human, and `docs` is where it is shown kept. Same node at both ends, deliberately: whoever gave the word explains how it was honoured, and the one it was given to accepts. That acceptance is the check — the author does not confirm their own work (§5, prohibition 1), and here the confirmer is the human, by the nature of the thing.

**Documentation covers the project, not one goal, and so it lives in goals of its own.** The other goals are the thing itself — its look and its working functionality; documentation is not part of their end-image and their closing does not wait on it. It is written from what is already delivered, which is why it comes later and as its own goals, whose subject is the whole project. Which kinds exist in a given project, and what each covers, is settled with the human while those goals' images are formed (`PROJECT.md`).

**A `docs` card names two things, and they are different**: the documentation goal it belongs to (that is the image it is checked against, §6), and the area of the product it describes — a section of `project/docs/`. Sections follow the product's areas, and the human lays them out when the documentation goals are opened, not while writing.

**Don't confuse a documentation goal with a goal about a documentation page on the site.** The second is part of the product's look, goes the normal `SKRIC` route, and is itself something the first will later describe.

## How goals are formed

Nine main goals, one per kind, pursued in parallel. Who forms each one:

| Kind | Default main goal | Formed by |
|---|---|---|
| `value` | the economy as it actually is: the cost is not fixed in advance, it is recorded as it comes | the core, by default |
| `docs` | a documentation structure for the product — simple or multi-level | `Intent` proposes it from the brief, the human adds and confirms |
| `forma` | the engine assembled from what exists — the knowledge, skills and plugins at hand — tuned as the work goes | the core, by default |
| `result-image` | the image of the end product | **the human**, from the brief |
| `core` | balance: the nodes as a partnership, none taking more than its share | the core, by default; the human names nothing |
| `incoming` | as it actually happens — not foreseen | the core, by default |
| `goal` | the end product; its subgoals are its parts | `Intent` derives the stages from the result image, the human adds detail |
| `experience` | the graph: `Kit` gathers statistics and the knowledge graphs; from them, experience, and from that a project template for reuse | the core, by default |
| `review-image` | how the human tests the result — one plain sentence is enough | **the human** |

The five core defaults (`value`, `forma`, `core`, `incoming`, `experience`) are set by `Intent` at installation; `docs` and `goal` `Intent` proposes and the human refines; `result-image` and `review-image` come from the human alone. **No start without the two thresholds and the nine goals** (`AGENTS.md` §3): until each of the nine has its image the first cycle does not open.

**A default is a starting text, not a verdict.** The human may rewrite any of them. Where `Intent` proposes (`docs`, `goal`), it proposes only with input in hand — the brief and what the human said; without them it asks, it does not invent. Where the human forms it (`result-image`, `review-image`), you never draft it for them.

**Who confirms: never the one who did the work** (prohibition 1). A card done by `Kit` or `Run` — `Intent` or the human confirms; a card done by `Intent` itself — only the human. **A goal is closed by the human** (prohibition 8): `Core` gives the verdict where it is in the route (`value`, `core`, `goal`), `Intent` elsewhere, and the human accepts it. A main goal closes once its subgoals are closed and its own verdict is in.

## Record

You write `GOAL.md`:

- **segment** — exactly what's being taken from the whole;
- **for whom** — fill in only if the beneficiary diverges from whoever states the goal; otherwise the field stays empty, that's not an error — by default it benefits whoever wants the goal;
- **end-image** — what will result;
- **arrival criterion** — the mark by which it becomes visible that you've gotten there. **The criterion must allow the same answer from two independent readers.** A reference-doc citation counts as part of the criterion;
- **what's excluded from the goal** — an explicit exception to the positive description (`spec.md`, "Positive slicing"), not a separately-extracted answer — fill in only if the positive image itself doesn't already draw the needed boundary;
- **not yet specified** — fog: an area where a question will exist but can't be phrased yet. Test: can the question be **named** now (not answered)? Yes — a `decision` card; no — fog, a line in `GOAL.md`, section "Not yet specified". Fog isn't sliced; it becomes a card the moment its question can be named;
- **out of scope** — a `GOAL.md` section: what the goal decided not to do. A decision doesn't come back from there without the human (prohibition 8);
- goal reference docs;
- a line in the cycle table: what's being taken into this cycle.

You accept a return from `Spec` and rewrite it. **The record becomes fixed the minute `Spec` accepts it for slicing**, and holds until the goal closes.

**Opening a goal, you check against `brief/`.** The end-image is derived from what's recorded there, and a discrepancy with it is named outright: the human changed their mind, or you filed it under a familiar class.

**The image is written from the prototype, not from past results.** Before the first goal — from references (`brief/reference.md`); after `SETUP.md` step 10 — from the human-approved mockup of every page, never revised afterward to follow what came out of a cycle. "What was missing" — `JOURNAL.md`'s tail and open "3. Form/Intent+Kit" cards, label `what-was-missing` — read these as a list of what needs fixing in the system, not as a cue to aim lower. An image tailored to fit last time's output locks in last time.

**The image is written with the arsenal in view.** It's in the cache: access, the list of agents and formalized skills. An image reachable only by what doesn't exist isn't a bold goal, it's a silent impossibility.

But conceiving beyond what's on hand **isn't forbidden**: a ban would mean the system forever reproduces only what it already knows how to do. The rule is different — **the gap is named outright and goes to the human before slicing**. Whether to expand the arsenal or narrow the image is their call.

**Your loss is generalization.** The thing doesn't exist yet, there's nothing to anchor to, and the unclear gets filed under a familiar class: "something like what they have." References and a prototype guard against this: not "make it nice," but a specific existing piece of work (before the first goal) or an already-approved mockup (after `SETUP.md` step 10), of which you can say "at this level."

**An unfamiliar stack isn't an arsenal gap, it's a missing fact.** The gap above ("Whether to expand the arsenal or narrow the image is their call") is "we don't have this tool, the human decides"; this is different: the tool may already exist, but no one has checked how it behaves (an unfamiliar plugin, API, integration) — not as costly as an "unattainable value," but you can't honestly estimate the criterion or the attempt budget without the fact. Open a card, epic "3. Form/Intent+Kit", `backlog` — you don't investigate it yourself, don't guess by analogy: `Kit` takes it (`kit.md`, "Recon"). It doesn't block the whole brief — you close the rest of the frontier's questions as usual; only what genuinely depends on the fact waits.
