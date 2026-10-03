# Project kitting — the `Kit` task at the Setup stage

About what `Kit` prepares after "the Look of the nodes" (`SETUP.md`, step 1b) and before goal creation (step 11) — not about kitting a single card (`kit.md`), but about kitting the whole project ahead of time, once, before the first card on the Board.

**This is not permanent knowledge of `Kit`.** The executable instruction lives in a separate on-demand file of the layer — `.claude/agents/on-demand/kit-project-kitting.md` (and the mirror `.agents/plugins/forma/agents/on-demand/kit-project-kitting.md`) — `Kit` reads it exactly at step 10b, in the same manner as `kit-recon.md` is read only on the epic card "3. Form/Intent+Kit" (`kit.md`, "Recon"/"Project kitting"). It is not loaded into `Kit`'s context on a regular task and does not remain with it after the step. This file is not the instruction itself but the rationale for why it is built this way.

---

## Place in the order of `SETUP.md`

Step **10b "Kitting"**, between the approved prototype (10) and goal creation (11): by this point it is known what exactly is being built (site map, design system, approved mockup of all pages), and not merely what the human wants in general terms (brief, step 1). Before this moment there is nothing to kit — the project plan does not yet exist in a verifiable form.

## What `Kit` has by this point

- **brief** (`brief/interview.md`) — formed by `Intent`, covers all five points of the "Five pairs" (`.forma/manual/en/03-forma/PROTOCOL.md`, "Each node's look at the brief");
- **four visions** (`brief/nodes-vision.md`, step 1b) — including `Kit`'s own reading, plus the readings of `Spec`, `Run`, `Core`, each under its own competence;
- everything given by steps 2–10: history, site map, prompt, references, design system, design of the landing page and the whole site, mockup, a prototype approved by the human.

None of these sources alone gives the full picture: the brief is the desire, the node visions are how each reads that desire through its role, the prototype is how it should look. `Kit` is the only node whose triad (Connect · Execute · Deliver) is exactly about reducing the different into one kitted whole; in the same manner as it kits `Run` for a single task (`kit.md`, "Task kitting"), here it kits the entire project plan.

## What `Kit` prepares — six items

1. **Candidate goals.** A draft list of goals (segments of work) — not the `GOAL.md` themselves: those are still written by `Intent` at step 11 (`intent-goal-opening.md`, "Recording"). `Kit` prepares the material — from which the slicing into goals follows — it does not substitute for the node responsible for the end-image.
2. **Requirements for the goals.** For each candidate goal — which references, facts, accesses are needed so that `Intent` can honestly write the end-image and the arrival criterion, without generalization out of thin air (`intent-goal-opening.md`, "Your loss — generalization").
3. **Epics.** Which substantive epics are needed beyond the seven process epics, whose closed list is already set by the protocol (`intent-goal-opening.md`, "Epic") — epics by sections of the site/project, specific to this project, not to the schema in general.
4. **Node kitting.** A preliminary arsenal: which skills, skills, connectors `Spec`/`Kit`/`Run`/`Core` will need to implement the whole goal plan — not a single card. An extension of the same kitting that `Kit` usually maintains at the task level (`kit.md`), here — ahead of time, for the whole project at once.
5. **Project documentation structure.** Which files and directories are needed, what each is about — the same work that `Kit` already does constantly (`project/CONFIG.md`, "6. Kit — Documentation (tooling)"), here — the first draft pass, before the structure has actually appeared as work.
6. **Additional data kitting.** What is missing from the brief and references for the rest — no longer an interview (`grilling` is closed at step 1), but recon after it.

### Additional kitting — who searches, where it goes

A gap found at this step is not homogeneous — it is distributed among categories already existing in the protocol, it does not invent a parallel mechanism:

| Kind of gap | Who closes it | Where it goes |
|---|---|---|
| A public fact about a technology/environment (plugin documentation, API, integration) | `Kit` itself — recon, in the same manner as the "Unfamiliar stack" (`AGENTS.md` §2; `kit-recon.md`) | `project/CONFIG.md`, "Environment technical contracts" |
| A decision or access known only to the human (password, account, business rule, preference) | the human | `VARS/credentials.md` / `.env` by kind (§5, p.15), or directly into `brief/kitting.md` |
| A fact `Kit` can find, but a choice among several options is a human decision | `Kit` searches and brings a question with options | to the human, in the same manner as the "human" row in the route (`AGENTS.md` §2) |
| A gap `Kit` cannot close without editing the image itself or extending the arsenal | the human decides | the epic "3. Form/Intent+Kit", or a return to the brief as an unattainable value |

## Where this is recorded

`brief/kitting.md` — a new file next to `interview.md`/`reference.md`/`nodes-vision.md`, by the same rule: not rewritten along the way — once it has diverged, a new entry with a date, the old one stays.

It then feeds:

- `project/CONFIG.md`, §6 — the structure and arsenal get their first draft form, then the file grows by fact, as usual;
- `PROJECT.md` — a preliminary list of project epics;
- step 11 of `SETUP.md` — the material from which `Intent` forms the real `GOAL.md`, not a bare decision from scratch.

## What this is not

- **It does not replace `intent-goal-opening.md`.** `Intent` still writes `GOAL.md`, the arrival criterion, decides "for whom" — `Kit` prepares the material, not the image.
- **It does not replace the `grilling` interview itself.** This is additional kitting after the interview (step 1 is already closed), not part of it and not a re-asking of the same four questions.
- **It does not substitute for "Recon".** A fact requiring investigation of an unfamiliar stack goes through the same epic "3. Form/Intent+Kit" (`kit-recon.md`) that `Kit` already uses in production — here the same mechanism is applied in advance, wholesale for the whole project, not one card at a time.
