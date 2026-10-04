# Project documentation

A knowledge base of what has been done. Structured by goals: each goal `project/goals/goal-NN-<name>/` has its own section here, `docs/goal-NN-<name>/`. Not by artifact type (architecture/guide/component) — by what this documentation explains.

**Who writes.** `Intent`, epic "2. Documentation/Intent" — **after the circle is closed**, not along the way. Not `Run`: it made the thing, but never addresses the human (`AGENTS.md` §1), and documentation is the Form explaining to the human what it has delivered.

**From what.** From the "Result" zones of closed cards and from the live result — `Intent` looks itself. Not the chronology of execution (that is in the card's history), not a verdict (that is in `GOAL.md`), and not a retelling of the cards: the reader of these pages knows nothing about cards, attempts and nodes and should not.

**Why after closing.** Documentation describes the confirmed, not the intended. A consequence follows that must be planned, not discovered: `Core` closes a circle's cards together, so the documentation of circle N is written in circle N+1, and the last goal needs a finishing circle.

**The kind is `work`, not `tooling`**, and documentation has its own goals: it is written for the whole project, not for each goal separately. Product goals deliver the product itself and must not deliver documentation — documentation describes what they have already delivered, and therefore comes later. Which kinds of documentation exist in this project and what each includes — `project/config/PROJECT.md`, "Documentation kinds"; how many goals go under them and how sections are laid out — the human decides when opening those goals.

**Who confirms.** The human. The author does not check themselves (`AGENTS.md` §5, prohibition 1), and the right checker here is the one who was promised.

---

## Structure of sections

A new goal on `ROADMAP.md` — a new section here, with the same directory name as `project/goals/goal-NN-<name>/` (the rule of carrying the directory over — `manual/en/03-forma/SCHEME.md`, sect. 6). There are no sections yet — the first appears with the first closed goal.

---

## Connection with the Kanban board (`.devtool/features/`)

Tasks refer to this base's articles by wiki-links, by the goal's section: `[[docs/goal-NN-<name>/...]]`.

* **In a task card** — a link to the relevant article of its goal's section.
* **In a documentation article** — the final description of the functionality, the decisions taken, links to the affected files.
