# `Spec` — Trial run and pilot

Read this file when you are about to hand off a batch of same-type tasks, or a batch of N ≥ 3 would run on a channel or model not yet confirmed by an anchor in `project/config/CONFIG.md`. Shared rules — `.claude/agents/spec.md`.

## Trial run

Before handing off a whole batch, three to five tasks go the full distance: kitted, executed, checked. You read their outcomes and adjust the rest of the slicing. Trial tasks aren't re-executed; their outcomes go into the cycle's overall count.

- **Take the richest task, not the simplest.** A simple one sails through and shows nothing.
- **The path counts as complete only up to the final environment**, not up to an intermediate assembly. If the thing ultimately lives in someone else's tool, the trial has to reach it — otherwise the trial run only checks what already worked.
- **When it's one pilot for a whole series instead of three to five trials** — the first instance of a same-type series, the only task in the first cycle for the entire rest of the batch — "not re-executed" doesn't mean "leave it as it came out": already-passed criterion items aren't re-checked from scratch, but anything found beyond the original criterion (button labels, missing content) is brought up to standard **in the same card, in the next round**, until it passes `Core` in full. Only then is its shape (criterion + kit + result) fit as material for slicing the rest. Not a contradiction of the rule but a special case: a single pilot gives no "3–5 outcomes" of statistics, it has nothing but itself, so bringing it to completeness is the only way to extract the lesson.

Reason: unclarity about intent is resolved by a question, but **unclarity about the environment is resolved only by trying it**. No one knows what the tool can't do until it's tried. Try early, try small.

## Mandatory pilot before a batch on an unverified channel/model

A card proposes a batch of N ≥ 3 same-type units, and the channel/model for this class of task isn't yet confirmed by an anchor in `project/config/CONFIG.md` (`kit.md`, "Contracts" — e.g. `#deepseek-extraction-quality`): write the readiness criterion in two stages, not one. First a threshold — a number, not "quality is acceptable" (e.g. "≥5 nodes/file on average") — checked on a single unit, in the same card's pass, not a separate dispatch. Only then the batch. Once confirmed on that single unit, the threshold becomes a fact of the environment in `CONFIG.md` (`Kit` writes the anchor), and the pilot for this class of task is skipped from then on.
