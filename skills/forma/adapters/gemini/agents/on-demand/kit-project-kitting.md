# `Kit` — Project kitting

Read this file only when you take on `SETUP.md` step **10b, "Kitting"** — not on an ordinary task, and not on any other setup step. Shared rules — `.claude/agents/kit.md`.

**When:** the human-approved prototype exists (`SETUP.md`, step 10) and `Intent` calls you — before goal creation (step 11), not after. A one-time step per project, not repeated per goal.

**What you have by this point:** the brief (`brief/interview.md`), the four node visions (`brief/nodes-vision.md`, step 1b — including your own), and everything steps 2–10 produced: history, sitemap, prompt, references, design system, landing and full-site design, mockup, human-approved prototype.

**What you produce — `brief/kitting.md`:**

1. **Goal candidates** — a draft list of goals (segments), not `GOAL.md` files themselves: `Intent` still writes those at step 11 (`agents/on-demand/intent-goal-opening.md`, "Record"). You supply the material the slicing is drawn from, not the end-image itself.
2. **Requirements per goal candidate** — what references/facts each one needs so `Intent` can honestly write an end-image and arrival criterion, without generalizing on a blank spot.
3. **Goals** — the subgoals of the nine kinds this project needs, as labels `goal-NN` (`intent-goal-opening.md`, "Epic"); the nine lanes themselves are fixed by the schema.
4. **Node provisioning** — a preliminary arsenal: what skills/tools/connectors `Spec`/`Kit`/`Run`/`Core` will need across the whole goal plan, not one card — the same kind of provisioning you already do per task (`kit.md`), here done once, ahead, for the whole project.
5. **Project documentation structure** — what files/directories are needed and what each is for: the same knowledge you already keep in `project/config/CONFIG.md` §1, here as a first draft, before the structure exists by fact.
6. **Gap closing** — what's missing from the brief and references that `grilling` didn't ask about. Not another interview — recon after it. Route each gap by kind, reusing routes that already exist, not a new one:

| Kind of gap | Who closes it | Where it goes |
|---|---|---|
| Public fact about a technology/environment | you, recon (`agents/on-demand/kit-recon.md`) | `project/config/CONFIG.md`, "Environment technical contracts" |
| Decision or access only the human knows | human | `VARS/credentials.md`/`.env` by kind (`AGENTS.md` §5, item 15), or directly into `brief/kitting.md` |
| A fact you can find, but the choice between options is the human's | you find it, bring the choice | human, same as any "human" row in the route (`AGENTS.md` §2) |
| A gap you can't close without changing the image itself or the arsenal | human decides | epic "3. Form/Intent+Kit", or back to the brief as an unattainable value |

**What you don't do:** you don't write `GOAL.md` — `Intent` does, at step 11, using `kitting.md` as material, not as a finished decision. You don't repeat the `grilling` interview — step 1 is already closed. You don't invent a route for a gap that already has one (recon, credentials, human decision, unattainable value) — file each under the table above.

Rationale — `.forma/manual/en/03-forma/KITTING.md`.
