# Project preparation

Universal for this type of project (landing + site). Walked once, before the first goal opens. The next project of this type inherits the same order by default.

---

## Steps

| № | Step | Where | Input | Output | Card |
|---|---|---|---|---|---|
| 1 | Brief | here | interview with the human | `brief/interview.md`, `brief/reference.md` (first, a light pass — `Intent`'s synthesis as the interview goes) | setup-1-brief |
| 1b | The nodes' view | `Spec`, `Kit`, `Run`, `Core` — each separately, then `Kit` merges | brief (1) | `brief/nodes-vision.md` — four independent visions of the brief + the tooling merged by `Kit` | — |
| 2 | History | here | brief (1) | `brief/history.md` — a systematized document: all the interview's source parameters, structurally laid out | setup-2-history |
| 3 | Site map | here | brief (1) | `mockups/sitemap.md` | setup-3-sitemap |
| 4 | Prompt for the landing page | here | history (2) | `brief/prompt.md` | setup-4-prompt |
| 5 | Collecting references | here | prompt (4), site map (3) | `brief/reference.md` — the same file, brought to completeness: now it is known what exactly to look for | setup-5-references |
| 6 | Defining the design system | here | references (5) | `project/reference/design-system.md` | setup-6-design-system |
| 7 | Landing page design — forming and refining | forming — outside, `aura.build`; refining — here, locally, with our own means | prompt (4), design system (6) | the landing's reference mockup, refined (kept on the `aura.build` side) | setup-7-landing-design |
| 8 | Design of all site pages, by the site map | outside, `aura.build` | site map (3), refined landing design (7), design system (6) | the reference mockup of all pages (kept on the `aura.build` side) | setup-8-site-design |
| 9 | Uploading the mockup | here | reference mockups (7, 8) | `mockups/v<N>/` — the version number (for example, `v1/`); the mockup of all pages as is, raw | setup-9-mockup-upload |
| 10 | Refining the mockup — the prototype | here, by the human/designer | mockup (9), site map (3) | `mockups/v<N>/` — the same folder, corrected and approved; becomes the prototype of all pages | setup-10-mockup-refinement |
| 10b | Kitting | `Kit`, by the instruction `kit-project-kitting.md` (the engine's role directory, §8) (read only at this step, not permanently) | prototype (10), brief (1), the nodes' view (1b), everything 2–9 | `brief/kitting.md` — candidate goals, requirements for them, epics, a preliminary arsenal of nodes, a draft documentation structure, a list of what to add to the kit | — |
| 11 | Creating goals | here | everything before, including `kitting.md` (10b) | `goals/goal-NN/GOAL.md` per segment; a line in `ROADMAP.md`/"The map" (the same goal is entered there too) | setup-11-goal-creation |

**11 of the 13 rows are cards of epic "6. Incoming/Intent"** (`PROJECT.md`, "Project epics") on the board `.devtool/features/` — each one's file is given in the "Card" column of the table above, the executor is `Intent`, outside the production route. Two exceptions, both without a card on the board (the board does not yet exist at this stage): step **1b** — `Spec`/`Kit`/`Run`/`Core` each read the brief separately (`manual/en/03-forma/PROTOCOL.md`, "Each node's view of the brief"); step **10b** — `Kit` merges everything gathered into the project's kitting (`manual/en/03-forma/KITTING.md`). Both are the same kind of housekeeping act as the other `Intent` steps (`AGENTS.md` §2), just with a different executor.

Step 1 is run in rounds by the frontier — `forma-grill-with-ui` if it is installed and a browser is available, otherwise `grilling` (the rule of choice — `intent-goal-opening.md`, "Epic"), not a one-off interview. Step 2 continues it directly, not a new topic: the interview records what was said, the history brings it into structure — separately, so that it can be checked whether anything was lost in the systematizing. The same `Intent` writes it, right after.

**Step 1b stands between the brief and the history, not as part of the interview but as a separate pass right after it.** The brief (1) — whole, covering all five items of the "Five pairs" (`manual/en/03-forma/PROTOCOL.md`, "Each node's view of the brief") — is passed to `Spec`, `Kit`, `Run` and `Core` separately, by the same isolated call by which they are called in production: each gets only the brief, without the others' readings. `Spec` reads how it breaks into linked parts; `Kit` — what tooling, access and skills are needed; `Run` — what is actually executable and where the risk is; `Core` — whether the image holds as one whole. `Kit` merges the four visions into `brief/nodes-vision.md`: a single picture of the skills and infrastructure needed — by its own triad (Connect · Execute · Deliver), not because it is more important than the others. The history (2) and the further steps still read the brief (1) directly — step 1b neither replaces nor rewrites it, it adds four independent checks of the image before a single attempt has been spent on it.

The site map (3) reads the brief (1) directly, not the history (2) — it is not to be rewritten to fit the history's structure, it needs only the facts. It also stands before the prompt (4) deliberately: a prompt for one page is written when the whole site is already in view, not the other way round. The prompt itself (4), on the contrary, is written from the history (2), not from the brief — because it needs the systematized form, not the chronology of questions and answers.

References (5) and the design system (6) stand between the prompt and the external design on purpose: it makes sense to look for samples and decide tokens already knowing both the site map and the prompt's text — not the other way round.

The design is split into two steps deliberately, not one: the landing (7) is what the prompt (4) and the design system (6) describe directly; the whole site (8) is the same extended to the other pages of the site map (3) only after the landing has set the language, not in parallel and not earlier. Step 7 does not end with forming: refining the landing happens right there, within the same step — here, locally, with our own means, not by another pass through `aura.build` — and the language for step 8 is the refined variant, not the raw one. Forming both mockups (7, 8) is what is done outside this project, on `aura.build`; their result is brought back by step 9.

The editor is [aura.build](https://www.aura.build): the same site that `kit.md` uses as a source of ready-made skills ("Arsenal"/"Limits") — here its other side, assembling the pages themselves. Access is through the MCP server `aura-build`: confirmed for the skill catalog (`aura_search_catalog`/`aura_get_catalog_source`, `kit.md`), while whether it also holds the canvas creation/publishing tools (`aura_create_canvas_html`, `aura_update_canvas`, `aura_publish_project` — they are in the server's list) for assembling the pages themselves has not been checked separately; for now the fallback is the browser MCP tools (`chrome-devtools`: `new_page`/`navigate_page`/`take_snapshot`/`fill`/`click`), already given to `Intent` and `Kit` — they also carry the local refining of the landing (step 7).

Step 10 is not a technical fix but a decision taken by the human: the mockup of all pages (9) is either recognized as fit and becomes the prototype — the fixed measure for the whole rest of the scheme (`intent.md`, `core.md`, "You do not judge the level") — or goes back for another round of refining.

Step 11 fills `ROADMAP.md` too, not only `GOAL.md`: from the brief — a short summary, in one line, in `ROADMAP.md`/"The whole" (if it is not yet filled in); each decided goal — as a node in "The map" beside it. `GOAL.md` — the result image and arrival criterion of one goal; `ROADMAP.md` — which goals exist at all and in what order. Later, when a goal is actually taken into work, an epic is set up for it on the board (`.devtool/features/`) — that is done by `Intent`, `intent.md`, "Epic"; the goal does not create an epic automatically, an epic is when `Spec` is already ready to slice it into cards.

---

**Epic "3. Form/Intent+Kit" is not tied to any goal and is available from the very start**, even before step 1: any node that runs into a question the human decides opens a card there (`AGENTS.md` §2). It does not need pre-registering either — the name is reserved by a rule, not by a file. The marker carries two names plus a conditional third in brackets, because execution is decided by the card's domain, not the epic as a whole: access/tool/skill — kitted by `Kit`, which executes it itself or, if the tooling needs an action on the site (for example, direct access to the site/API, which `Kit` deliberately lacks), hands it to `Run` — hence the brackets, the participation is conditional (`kit.md`, "Infrastructure"); a scheme/reference file (`AGENTS.md`, the engine's role files, `manual/`) — `Intent` itself, directly with the human (`AGENTS.md` §2). All cases — without `Spec`/`Core`.

---

Next — `Spec` slices the tasks. That is already the next node, outside this preparation.
