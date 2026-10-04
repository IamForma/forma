# Decision log (ADR)

A permanent record of the project's closed decisions (`AGENTS.md` §6). Format source: [mattpocock/skills, `domain-modeling/ADR-FORMAT.md`](https://github.com/mattpocock/skills/tree/main/skills/engineering/domain-modeling), adapted.

**When one is made — three conditions at once:**
1. **Hard to reverse** — changing one's mind later is expensive.
2. **Surprising without context** — a future reader will ask "why is it like this?".
3. **The outcome of a real choice** — there were genuine alternatives, one was chosen for reasons.

If even one is missing — no ADR is made: the decision stays in the card.

**Who writes:** `Intent`, when confirming a closed card of kind `decision` (or any whose outcome is a decision). The card keeps the grounds, the ADR keeps the permanent record.

**Numbering:** the highest number in the folder + 1: `0001-<slug>.md`.

## Template

```md
# {Short name of the decision}

{1–3 sentences: context, what was decided and why.}

Source: card-NNN.
```

One paragraph is enough. Optional sections — only when they carry meaning:

- **Status** in the frontmatter (`proposed | accepted | obsolete | superseded by ADR-NNNN`) — when the decision is revisited;
- **Options considered** — when the rejected is worth remembering;
- **Consequences** — when they are not obvious.

**What qualifies:** the shape of the architecture; the way parts are connected; a technology choice with lock-in; boundaries and scope (explicit "no"s are as valuable as "yes"es); a conscious departure from the obvious path; constraints not visible in the code; non-obviously rejected alternatives.
