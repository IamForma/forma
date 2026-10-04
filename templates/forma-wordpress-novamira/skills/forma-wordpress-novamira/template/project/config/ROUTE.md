# Project route — `forma-wordpress-novamira`

**The route defines what kind of project this is.** Not the stack and not the set of plugins: the sequence of steps *is* the template. This file is the route of the template the project stands on; it is installed together with the template and read by `Intent` at the fifth position of the interview.

**Not to be confused with its neighbours.** `ROADMAP.md` — what goals the project has. `SETUP.md` — the installation checklist with cards on the board. **`ROUTE.md` — how the project moves at all**: where things come from and why the steps stand in this order. Goals answer "where to", the route — "by what path".

**Status of the record: a projection of practice, not something the system has passed.** The route below is how the template's author actually works and gets results. But it has not yet been passed from start to finish through the nodes even once. These are two different claims, and the second is not made here: while the "Passed" section is empty, the template cannot be called verified. Once you have passed it — record it as confirmed, in a new entry with a date.

---

## Steps

| № | Step | Input | Output | Where it is done |
|---|---|---|---|---|
| 1 | **Interview** | the human | the end-image and story of **the first page, the landing** | `Intent` + `grilling` |
| 2 | **Landing prompt** | interview context + references | `brief/prompt.md` | here |
| 3 | **Landing** | prompt + references | the first landing: design system, styling, narrative of the story | **Aura**, outside |
| 4 | **Sitemap** | predefined structure + the human's choice | `mockups/sitemap.md` | here |
| 5 | **Page templates** | the landing as a prototype + the sitemap | a mockup of every page on the map | **Aura**, outside |
| 6 | **v1** | an export of the whole site from Aura as is | `mockups/v1/` | Aura → local |
| 7 | **v2** | v1 | a prototype of the site as it must be: flaws, inaccuracies, mismatches fixed, everything brought to unity | local |
| 8 | **v3** | v2 + reality | **the final result**: fitting to fact — something corrected, something filed down | local → site |
| 9 | **Functionality** | v3 | finishing: additional elements, visual and internal | site |

**Why the interview comes first and cannot be bypassed.** Without it there is no context for what the landing must be. Without the landing there is no design system, styling or narrative. And the landing is **the prototype of all the other pages**: everything that follows inherits from it. Skipping step 1 means not "starting later" but building the other pages after a model that does not exist.

**Why the sitemap is not composed from scratch.** The sections do not change from site to site — it is one assembly structure of the same plugins. The work comes down to a choice: what we use, what we do not.

**What the three versions of the mockup mean.** Not three drafts of the same thing but three different states: exported as is → brought to unity → fitted to reality. **v3 is the very reality we get.** After it the image is no longer formed, only functionality is pressed home.

---

## Passed

**Filled in at the moment a step is passed, not at the end.** It cannot be reconstructed afterwards: deviations, detours and steps that turned out to be superfluous are, by the end of the project, indistinguishable from the design.

This section is the reason the route is written down. **The template snapshot for the community is built from here, not from the table of steps above:** that one says how we meant to go, this one — how we went. A snapshot taken from intent would declare the unverified verified — exactly what it must guard against.

| Step | When | How it went | Divergence from the design |
|---|---|---|---|
| — | — | not a single one yet | — |

**What goes into a row:** the date, how the step ended in fact, and, in a separate column, whether it diverged from how the step is described above. If it diverged — it is written as it is; the table of steps is corrected, not this record.

## Choice points

The route is predefined, the content is not. These decisions are made by the human, and until then they are open. Each is a card of the "decision" kind on the board, not `Intent`'s guess.

| Decision | State |
|---|---|
| Shop — yes or no | open |
| Community — yes or no | open |
| Which sections of the predefined structure we take into work, which not | open, resolved at step 4 |

A decision taken beyond the boundary of the design goes to "Out of scope" and does not return from there.

## Not yet specified

Areas where it is visible that a question will come, but it cannot yet be stated exactly. The test: **can you name the question now** — then it is a decision, not fog; if you cannot — it goes here.

- the predefined list of content epics of this template: the principle is clear (an epic per section of the site), the composition depends on step 4;
- which steps of the route need access that does not exist yet.

## Out of scope

Empty for now.

---

## How `Intent` uses this — the fifth position of the interview

The fifth position ("naturalness") is the route itself: by what natural way everything is finally realized. It has **two branches**, and they cost differently.

**The template is installed — a check.** The route is already known, it is in this file. `Intent` does not synthesize it anew: it **clarifies whether there are divergences** between what the human wants and what the template assumes. A divergence is named aloud, not smoothed over. Cheap.

**No project, starting from scratch — construction.** There is no file, the route has nowhere to be taken from. `Intent` must work out itself what we do first, what second, what third — that is, a notion of the natural course of realization. A large piece of work, and it precedes the goals rather than follows them.

**Synthesizing a route that is already written down is a mistake**: it is composing the decided anew and a divergence from the template out of nowhere.
