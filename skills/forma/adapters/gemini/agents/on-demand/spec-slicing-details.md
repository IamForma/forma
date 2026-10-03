# `Spec` — Slicing details

Read this file when you slice documentation (epic "2. Documentation/Intent"), a content unit (a post, a page, a demo example), a style, tone, grid or palette that runs through every part, or rework a closed card; also for the limits and the rationale of "Homogeneity of a cycle". Shared rules — `.claude/agents/spec.md`.

## Reworking a closed card

**Two different ways, and the dividing line is the pilot:**

| Stage | How a rework is done | Why |
|---|---|---|
| **On the pilot** (the first instance of a series, before it passed `Core` in full) | **merges into the same card as a new round** — round number up, card number unchanged. `Intent` sets the status back to active (not `done`), increments `round` in the frontmatter, and never rewrites the history, only appends | the "done well" shape doesn't exist yet — it's what's being assembled. Smearing it across a dozen descendant cards means reassembling it later when slicing the rest |
| **After the pilot** (it passed `Core` with its whole criterion closed and became the reference standard) | a **sub-task with `parent`**: a new card, same process — its own five fields, own kit, own history, not a checklist inside someone else's card — plus frontmatter `parent: "<parent card id>"` | "good" is now known, so spreading across sub-tasks is safe: each fixes a detail against an already-verified whole. The board stays flat, the link is by field: `grep 'parent: "..."'` finds every rework of one entity in one query |

A rework touching several entities at once (a shared template, a shared bug) points `parent` at the card where the finding was first spotted — the finding's origin, not a claim that the fix is limited to one entity.

## Homogeneity of a cycle

**Cards of one specification go into one cycle and are handed off consecutively.** Same specification means the same kit: same role, skill, tool, access, data, model. Group them; don't interleave them with cards that need a different kit.

This isn't tidiness, it's the cost of instruction. The rules and the role file are re-read into **every step** of a call, not once per attempt. What makes that re-reading cheap is the cache, and the cache holds on an identical prefix — which is exactly what an identical kit is. Cards of one specification run back-to-back: the first pays for the instruction, the rest read it at a fraction. Interleaved, every card pays in full.

Two limits on this, both hard:

- **It is not a reason to cut more coarsely.** "One qualification" governs the card and doesn't bend to grouping; this rule orders cards, it never merges them. The volume threshold caps how many go into one cycle (`PROJECT.md`).
- **It is not shared memory.** Every task stays its own isolated call with a clean card. The saving comes from the cache, not from a node remembering the previous task — a doer carrying its own past contradicts prohibition 7, and isolation is what makes prohibitions 1 and 7 hold by construction (§2). **Continuation of the same `Run` (`AGENTS.md` §2) is a named, narrow exception to that isolation, not a loosening of it:** it fires only under the five conditions `kit.md` lists (execution slip, first miss on the point, live call, unchanged role/kit/model, not an external-model task), the doer still never receives its own failure history — only `Kit`'s written correction — and every other cause of a return still goes through a clean, isolated reassembly.

When cards of one specification can't be grouped — a dependency forces the order — that's a fact, not a failure: note it in the history and cut as the dependency requires. Input coverage outranks homogeneity.

## Slicing documentation

A card in epic "2. Documentation/Intent" is `work`, and work is checked against the end-image (§6). It belongs to a **documentation goal** — not to the goal whose area it describes, which owes no documentation of its own. Name both in "what it delivers": the documentation goal, and the section of `project/docs/` being written.

**One kind, one card.** Writing for someone using the thing and writing for someone who will maintain it are different qualifications, and "one qualification per card" applies here like anywhere. Two kinds covering the same area means two cards, never one card producing both.

Below that, don't slice further — not per page, not per screen. A section accumulates across closed cycles; it isn't rebuilt each time.

## Content, not a mockup

A card creating a content unit (a post, a page, a demo example) puts content into its readiness criterion, not an empty shell: a post has an image, not a placeholder; has a gallery — several images in it, not one, not ten, and you decide the exact number for the entity. Image generation is an image model assigned in `Kit`'s kit; the prompt for a specific entity's subject is written by `Run` before the call — not one generic prompt for all entities at once. The tool is `Kit`'s; the criterion is yours.

**The model is chosen by purpose — not always the same one, not from memory.** Cost is checked with `simulate_cost` before the first use of a new model in this project: figures aren't in the model catalog, may not match "what everyone knows," and change without notice. Propose the verified figure and the demo-content model choice as a value of this project — a line in the card's history (only `Intent` writes into `VARS/` itself, `agents/on-demand/intent-goal-opening.md`/"After the verdict", same order as for `Kit`). Don't rely on figures from another project or from memory: model pricing isn't shared across environments.

## Layers, not tasks

Style, tone, grid, palette run through every part and don't get sliced into tasks. Their place is a **reference doc** (`reference/`, linked from every card's criterion) or a **value** (`VARS/<entity>.md`, reference `[[name]]`), resolved before the cycle.

A long sequential chain is a sign of slicing by layer instead of by outcome. Re-read the slicing.
