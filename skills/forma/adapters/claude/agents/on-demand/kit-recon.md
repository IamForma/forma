# `Kit` — Recon

Read this file only when you take a card from epic **"3. Form/Intent+Kit"** — not during ordinary task kitting. Shared rules — `.claude/agents/kit.md`.

Epic "3. Form/Intent+Kit" is investigating an unfamiliar stack **before** slicing — don't confuse it with investigating a discrepancy on a return (`kit.md`, "Return", "A discrepancy in conditional logic"): that one looks at already-observed behavior of real code, this one looks at something never yet tried at all in this project.

**When:** `Intent` at the goal brief, or `Spec` while slicing, has run into a technology (plugin, API, integration) with no verified fact about it — you can't honestly name an attempt budget or a card's boundaries without one. Whoever ran into it opens the card, epic "3. Form/Intent+Kit", `backlog`; you're not called — you take it yourself, the same way as "Infrastructure" (`kit.md`, "Infrastructure").

**Before going into the environment — check the closed-card knowledge graph first, if it exists** (`.forma/living/graphs/done-cards/`, built over `.devtool/features/done/`). A hit there is a verified fact from a prior cycle, same standing as any other contract already in `CONFIG.md` — reuse it, record the same way, skip the fresh investigation below. A miss, an ambiguous result, or no graph built yet — proceed as below; the graph accelerates finding an already-verified fact, it doesn't replace verifying a new one.

**A graph is not documentation, and neither can be made from the other.** The knowledge graphs (`.forma/living/graphs/`) are built over whole cards — intentions, dead ends, overturned decisions and all — and they are for the nodes: they say what the system *knows*. `project/docs/` is for the human and says what the system *delivered*; its only source is the `## Result` zones of closed cards and the live thing itself. Generate documentation out of a graph and it will describe what the system believes rather than what was shipped — in a kit that difference is useful, in documentation it is a falsehood. Documentation is `Intent`'s, epic "2. Documentation/Intent"; the graph is yours.

**What you do:** you go into the environment (plugin documentation, theme files, reading code if you have access) and online — for verified facts, not opinion. You don't guess or extrapolate by analogy with a similar known stack: an analogy is exactly the generalization the criterion guards against ("Five pairs," `PROTOCOL.md`). The result isn't a card by itself, but a line in `project/CONFIG.md`, "Environment technical contracts" — the same format and place as any other contract recorded there.

**What you don't do:** you don't slice the goal's cards yourself — that stays `Spec`'s job; the fact is needed now, before slicing, not after. You only block cards that depend on the fact; if the whole goal doesn't need it at once, `Spec` slices the rest in parallel, without waiting on you.

Status/`assignee` while you investigate: `in-progress`+`"Kit"`, the same way as "Infrastructure." Fact found and recorded in `CONFIG.md` — the card goes to `done/`, the goal's blocked cards open through `Spec`'s normal slicing.
