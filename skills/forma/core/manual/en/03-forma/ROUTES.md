# Route choice — who executes a task, when, and by which path

A reference for choosing a route for a task. Written for two readers: the human who decides, and the model that chooses a route at the moment a task opens. The assessment is by common sense, not by the current wording of `AGENTS.md`: it is the ground for amending the law, not a retelling of it.

---

## 1. The problem

- `Intent` can technically do everything itself, but **one context at once gets cluttered by the work and has to keep its record**. As the context grows, model accuracy degrades: `Intent` loses the thread of the conversation with the human and the key to the intent.
- Clearing the context erases the working memory of the task. Writing into the card keeps a trace, but also inflates the context of whoever writes.
- The way out: **execution lives in a separate context** and is recorded into the card there. `Intent` holds the intent and the acceptance and reads only the summary.

**Principle of distribution:** the task goes to whoever will have the cleanest and narrowest context for that work.

**What each node in a route costs.** Every separate call pays a fixed part: loading the law and its own role (cache-read). On a small task that part is bigger than the work itself; on a series it is divided by the number of tasks. Hence the whole choice: a long route pays off either through the cost of error or through volume.

## 2. Axes of choice

| Axis | Question | Longer route if |
|---|---|---|
| Cost of error | what breaks if the result is wrong, and who will notice | the error is expensive or invisible |
| Size | is the work shorter than its card; does it fit in one context | the work is large |
| Criterion precision | is the result checked by fact (file, comparison) or does it need an eye | the criterion is not obvious |
| Slicing readiness | the brief lies in an accepted document, or it has to be sliced | it has to be sliced |
| Kit readiness | is there a role and kit for this kind of task | there is no kit |
| Consumer | who reads the result: a human or another agent | an agent reads it — the criterion must name the form |
| Scale | one task, or the known volume of a whole goal | the volume is known → `route-8` |

## 3. Codes and summary table

**Route code** — `route-N`; in speech, "route N" («маршрут N» in Russian). **Overlay code** — `over-N` (from *overlay*); in speech, "overlay N". One and the same code in the documentation, the law, the configuration, the card label and the dashboard; a route has no other names.

**Why the numbers go this way.** The number grows with the count of separate calls and with the independence of the criterion from the acceptor:

| Group | Routes | Calls | Who writes the criterion |
|---|---|---|---|
| no calls | `route-0` | 0 | `Intent`, who also accepts — the human approves |
| one call | `route-1`…`route-4` | 1 | `Intent` — the human approves |
| two calls without `Spec` | `route-5` | 2 | `Intent` — the human approves |
| with `Spec` | `route-6`…`route-8` | 2 or more | `Spec`, not the acceptor — no human approval needed |

Inside the "one call" group the order is by how far the work moves away from `Intent`: its own copy → an outside executor → `Kit` only gathers grounds → `Kit` executes itself.

Hence a simple rule: **`route-0`…`route-5` require the human's approval of the five fields, `route-6`…`route-8` do not.**

Scale: ●●● good, ● poor.

| Code | Route | Chain | `Intent` cleanliness | Trace | Guard against self-deception | Price | Where it pays |
|---|---|---|---|---|---|---|---|
| `route-0` | `Intent` itself | `Intent` | ● | ●● | ● | ●●● | an edit shorter than the card |
| `route-1` | copy of `Intent` | `Intent` → copy of `Intent` → `Intent` | ●●● | ●●● | ●● | ●● | a large task only `Intent` understands |
| `route-2` | `Intent` → `Run` | `Intent` → `Run` → `Intent` | ●●● | ●●● | ●● | ●●● | clear brief, standard kit |
| `route-3` | decision | `Intent` → `Kit` → human | ●●● | ●●● | ●●● | ●● | a question, not a delivery |
| `route-4` | `Kit` executes | `Intent` → `Kit` → `Intent` | ●●● | ●●● | ●● | ●● | tooling, recon |
| `route-5` | `Intent` → `Kit` → `Run` | `Intent` → `Kit` → `Run` → `Intent` | ●●● | ●●● | ●● | ●● | clear brief, a special role needed |
| `route-6` | `Spec` → `Run` | `Spec` → `Run` → `Intent` (kit from the library) | ●●● | ●●● | ●●● | ●● | the kind of task has been met before |
| `route-7` | full cycle | `Spec` → `Kit` → `Run` → `Intent` | ●●● | ●●● | ●●● | ● | expensive error, new stack |
| `route-8` | scale | segments × waves × `route-2`…`route-7` | ●●● | ●●● | ●●● | ●●● on volume | a large goal with a stable image |

**Overlays** change one link inside a route and are set as a second label. The number follows the order of the link in the chain: kit → executor → number of executions → acceptance.

| Code | Overlay | Changes | Where it pays |
|---|---|---|---|
| `over-1` | kit library | the kit is taken ready-made | a recurring kind |
| `over-2` | external cheap model | the executor | mechanics checked by fact |
| `over-3` | series | number of executions per one preparation | a uniform series |
| `over-4` | batch acceptance | the acceptance | a stream of uniform small tasks |


---

## 4. Routes in detail

Each route is described the same way: chain, when to choose it, why it works, when not to, risk and guard, who approves.

### `route-0` — `Intent` itself

- **Chain:** `Intent` understands, does, records into the card, accepts.
- **Choose when:** the work is shorter than its card — a typo, one value, a rename by an exact list. Describing the task for another node takes longer than doing it.
- **Why it works:** not a single call — no fixed part of spend. The clutter is small because the work itself is small.
- **Not when:** the work needs reading more than a couple of files, searching, trying; `Intent` has already made several such edits in a row (clutter accumulates); the result is not checked by fact.
- **Risk:** did it itself — accepted it itself; clutter accumulates unnoticed. **Guard:** the result is checked by fact (diff, file), the human sees it in the same reply; after several `route-0` in a row the next ones go through `route-1` or `route-2`.
- **Approves:** the human — by approving the card or accepting the result.

### `route-1` — a copy of `Intent` in a clean context

- **Chain:** the main `Intent` writes the card → a copy of `Intent` (a separate call with the `Intent` role, receiving **only the card**, not the conversation) executes → the main `Intent` accepts.
- **Choose when:** `Intent` understands the task best of all (the text of an image, a document for the human, a check against the brief), but it is too large to do in the main context.
- **Why it works:** it is `route-0` without the clutter. The main context stays clean, execution is isolated, acceptance is separated from execution.
- **Not when:** the copy needs the whole conversation — then there is no cleanliness, it is `route-0` at double price. That means the card is badly written: finish the card first.
- **Risk:** the same blind spot — the copy looks with the same eyes. **Guard:** the criterion is checked by fact; for expensive tasks — `route-7`.
- **Approves:** the human — the five fields of the card.

### `route-2` — `Intent` → `Run`

- **Chain:** `Intent` writes the card with the criterion → `Run` executes in a clean context with the standard kit → `Intent` accepts by the criterion.
- **Choose when:** the brief already lies in an accepted document (nothing to slice), the kit is standard (repository files, ordinary tools), the criterion is checked by fact.
- **Why it works:** `Intent` does not carry the arsenal and is not cluttered by execution; one call instead of three; the executor writes the trace.
- **Not when:** the criterion is not obvious; a special role, access or skill is needed; another agent reads the result and the consumer is not named in the criterion.
- **Risk:** the criterion is written by the same one who accepts — `Run` will do it "right" but not the right thing. **Guard:** the human approves the five fields before the call; the criterion names the consumer and the form.
- **Approves:** the human — the five fields of the card.

### `route-3` — a decision without execution

- **Chain:** `Intent` names the question → `Kit` gathers grounds and options → the human decides → `Intent` records the decision and, if needed, an ADR.
- **Choose when:** the output is a question, not a delivery: choice of a tool, an architecture fork, "do it or not", an engine rule.
- **Why it works:** `Run` has nothing to execute — calling it means paying for an empty call.
- **Not when:** the answer already follows from accepted documents — that is reading, not deciding.
- **Risk:** it drags on if the grounds are vague. **Guard:** the criterion names what the decision must settle and who takes it.
- **Approves:** the human decides.

### `route-4` — `Intent` → `Kit`, `Kit` executes itself

- **Chain:** `Intent` writes the card → `Kit` does it itself → `Intent` accepts.
- **Choose when:** the task is tooling of the engine itself, recon of an unfamiliar stack, wiring up a tool or access. That is, work where knowing the arsenal is the execution.
- **Why it works:** a handoff from `Kit` to `Run` here only loses meaning — `Run` would have to be told what `Kit` already knows.
- **Not when:** the task is production of the product, not tooling.
- **Risk:** `Kit` judges tools it chose itself. **Guard:** `Intent`'s acceptance by the criterion; the human approves the fields.
- **Approves:** the human — the five fields of the card.

### `route-5` — `Intent` → `Kit` → `Run`

- **Chain:** `Intent` writes the card → `Kit` assembles the kit for the task → `Run` executes → `Intent` accepts.
- **Choose when:** the brief is clear, nothing to slice, but a role is needed that the standard kit lacks: a special skill, site access, MCP, an external service.
- **Why it works:** `Kit` knows the arsenal and answers for its completeness; `Run` gets exactly what it needs and does not search on its own.
- **Not when:** the criterion is not obvious (`Spec` is needed); the kit already exists ready-made (that is `route-2` or `over-1`).
- **Risk:** the same weakness of the criterion as in `route-2`. **Guard:** the same — the human's approval, the consumer in the criterion.
- **Approves:** the human — the five fields of the card.

### `route-6` — `Spec` → `Run` with a ready kit

- **Chain:** `Spec` slices → `Kit` is not called, the kit is taken by name from the library (`over-1`) → `Run` executes → `Intent` accepts.
- **Choose when:** slicing is needed, but the kind of task has been met before and its kit is recorded.
- **Why it works:** the main thing is kept — the criterion is written by someone other than the acceptor; no `Kit` call is needed.
- **Not when:** there is no kit for the kind, or the case differs from the kind (new access, new tool).
- **Risk:** the kit is outdated. **Guard:** `Run` returns the task on a missing field — then it goes to `Kit` (`route-7`), and `Kit` updates the library entry.
- **Approves:** not required.

### `route-7` — full cycle `Spec` → `Kit` → `Run` → `Intent`

- **Chain:** `Spec` slices and writes the criterion → `Kit` kits → `Run` executes → `Intent` accepts.
- **Choose when:** the error is expensive or invisible; the stack is new; the criterion is not obvious; the task must be sliced; another agent reads the result.
- **Why it works:** four different contexts, and the criterion is written by someone other than the acceptor. Each node catches its own loss: `Spec` — omission, `Kit` — distortion, `Run` — substitution, `Intent` — generalization.
- **Not when:** the task is small and clear — preparation eats up to half the spend (cycles 040–043: 44%).
- **Risk:** price. **Guard:** on a series — `over-3`; on a whole goal — `route-8`; on a repeated kind — `route-6`/`over-1`.
- **Approves:** not required — the separation of roles is built in.

### `route-8` — the scale pipeline

- **Chain:** `Intent` describes the image and divides the goal into segments → per segment: `Spec` slices → `Kit` kits by kind → `Run` × N along the graph → `Intent` accepts → `Core` checks the segment → the plan of the next segment is corrected.
- **Choose when:** the goal's image is clear and stable, the volume is large, the tasks are mostly known.
- **Why it works:** preparation is called once per segment and divided over all its cards; `Spec` sees the whole and does not breed duplicates; `Kit` assembles a role per kind, not per card; independent tasks run in parallel.
- **Not when:** the image is still being sought — slicing ahead cuts air. Then one by one (`route-2`–`route-7`) until the image settles.
- Stages, risks and choice inside — section 6.

## 5. Overlays in detail

### `over-1` — kit library

- **Changes:** the kit is not assembled but taken by the name of the task kind.
- **Choose when:** the kind of task has been met before and its kit is recorded.
- **Where it comes from:** `Kit` records the kit of a kind after its first successful acceptance. The library grows from cycles; it cannot be assembled ahead.
- **Guard against aging:** a `Run` return on a missing field updates the entry; each entry carries a date and a source card.

### `over-2` — external cheap model

- **Changes:** the executor.
- **Choose when:** mechanics — replacement by list, formatting, translating ready text, extracting fields — and the result is checked by fact ("was → becomes", a file).
- **Not when:** judgment is needed — design, architecture, text for people, a choice.
- **Why with care:** a weak model errs quietly; without a mechanical check no one will see the error.

### `over-3` — series

- **Changes:** one slicing and one kit for N executions.
- **Choose when:** N uniform tasks — identical pages, identical edits in different places.
- **Why:** the fixed part of preparation is divided by N.
- **Guard against the main risk** (template error × N): the first card is a trial, the rest start after its acceptance.

### `over-4` — batch acceptance

- **Changes:** the acceptance — one per batch.
- **Choose when:** a stream of uniform small tasks, the error is cheap and reversible, one criterion for the whole batch.
- **Not when:** even one task is expensive on error or others depend on it — it is accepted individually.

---

## 6. Choice at scale (`route-8`)

### The problem

On a single task `Intent` chooses the route: it sees the task whole before any call. At scale this does not work:
- roles and kits do not exist until the tasks are sliced;
- what is cheap and what is expensive is visible only after slicing — and `Spec` slices;
- so everything seems to run as a full cycle by itself, and there seems to be no choice.

### Answer: the choice does not vanish, it stratifies

At scale a route is chosen at three levels, and at each by the one who sees what is needed:

| Level | Who chooses | What | Why them |
|---|---|---|---|
| Mode | `Intent` | `route-8` or one by one; segment boundaries and order | sees the goal's image and knows whether it is stable |
| Card | `Spec` **proposes** | the route of each segment card by the rule (section 7) | only it, after slicing, knows the kind, size, criterion and dependencies of each card |
| Kit | `Kit` **refines** | whether a role exists for the kind (`over-1`) or must be assembled; who executes — `Run`, an external model (`over-2`) or itself (`route-4`) | only it knows the arsenal |
| Approval | `Intent` | the segment's route map **in one decision**, not card by card | control stays with it without recounting every card |
| Check | `Core` | whether the choice was good — by the segment's numbers | the rule learns from facts |

**Inside `route-8` not everything runs as a full cycle.** Slicing and kitting are shared per segment; only the last links of each card differ:
- who executes: `Run`, an external model (`over-2`) or `Kit` for tooling (`route-4`);
- how it is accepted: individually or in a batch (`over-4`);
- whether there is execution at all: a decision (`route-3`) — without `Run`;
- a uniform series: one kit for all (`over-3`).

This is exactly what `Spec` proposes on each card.

**Where roles come from if tasks are not sliced.** Hence the order: first `Spec` slices the segment, then `Kit` assembles roles by kind. The first segment is the most expensive — there is no library yet. Each next one is cheaper: kinds repeat, kits are taken from `over-1`. `Core` sees this as the share of preparation falling from segment to segment — that is the measure that `route-8` works.

### Control

- **`Intent`'s control is approval, not counting.** `Intent` does not recompute the route of each card: it approves the segment map and looks at the exceptions — cards where `Spec`'s proposal diverges from the rule or where `Kit` lengthened the route.
- **The human** sees the route map at the segment boundary, together with the presentation of the previous segment's result.
- **If `Intent` disagrees** with `Spec`'s proposal, it changes the card's route and writes the reason into the history. This remains its right, not a duty on every card.

### Waves: order of execution inside a segment

Not all cards of a segment can run at once: some need others' results, others edit the same files. Only the one who sliced sees the order — so **`Spec` determines the waves, in the same pass as the slicing**.

| Step | Who | What |
|---|---|---|
| 1. Dependencies | `Spec` | each card gets "after card-NNN": whose result it needs |
| 2. Overlaps | `Spec` | cards that edit the same files are not put in one wave, even if logically independent |
| 3. Waves | `Spec` | wave 1 — cards without dependencies; wave N — those whose dependencies close in waves before N. The first card of each kind goes as a trial in the earliest possible wave |
| 4. Kitting | `Kit` | kits all segment cards by kind, attaches role and kit to the card; draws up the **launch plan**: wave → cards → role and executor of each |
| 5. Resource limits | `Kit` | if two cards of one wave hit one resource (a site, a service limit), `Kit` chains them inside the wave. Moving a card **between** waves `Kit` cannot do — that changes dependencies, a return to `Spec` |
| 6. Launch | dispatcher | executes the launch plan mechanically: a wave's cards in parallel, the next wave after acceptance of the current one |
| 7. Wave gate | `Intent` | accepts the wave's cards; the next wave starts when all its dependencies are accepted, not the whole wave |

**Who physically launches.** Decisions belong to `Spec` (order) and `Kit` (kit and executor). The call itself is mechanics, and it must be done by one who can call nodes and does not get cluttered: in Claude Code a subagent does not call subagents, so `Kit` cannot launch `Run` itself. Two ways:
- **a deterministic script** (Workflow): `Kit`'s launch plan becomes a script — waves, parallel calls, waiting for acceptance. `Intent`'s context does not grow with each call; only wave results reach it. Preferred at scale;
- **`Intent` as dispatcher**: calls by the plan itself. Fits two or three waves of a few cards; beyond that each call settles in its context, and that is clutter again.

In both cases the dispatcher **decides nothing**: it does not change the order or reassemble a kit. A deviation from the plan is a return along the route.

**Failure inside a wave.** A card fails acceptance → return to `Kit`, reassembly, again in the same wave. Cards depending on it wait; independent ones go on. A dependency failure (a card needs another that is not in the plan) → return to `Spec`, waves rebuilt from that point.

**Where it is recorded** — section 9: the card carries labels `seg-N`, `wave-N`, `after-card-NNN`; the segment plan and launch plan — `GOAL.md`, section "Segments".

**What `Core` measures by waves:** how many cards returned in each wave; how much idle time came from dependencies; how many times waves were rebuilt — the measure of `Spec`'s slicing quality.

## 7. The choice rule

Questions in order; the first "yes" determines the route. `Intent` on a single task and `Spec` on a segment card read one and the same rule.

1. Is the output a question, not a delivery? → **`route-3`**.
2. Is the work shorter than its card? → **`route-0`**.
3. Is the whole volume of the goal known and the image stable? → **`route-8`**; each segment card — again by questions 4–7.
4. Is the cost of error high, the stack new or the criterion not obvious? → **`route-7`**.
5. Slicing needed, a kit for the kind exists? → **`route-6`**.
6. The brief lies in an accepted document: standard kit → **`route-2`**; special → **`route-5`**; it is tooling → **`route-4`**.
7. `Intent` understands the task best, and it is large? → **`route-1`**, not `route-0`.

**Overlays** — after the route is chosen, independently of each other:
- a uniform series → **`over-3`**;
- a kit for the kind is recorded → **`over-1`**;
- mechanics checked by fact → executor **`over-2`**;
- a stream of uniform small tasks → acceptance **`over-4`**.

**Cross-cutting:** in the criterion of any work item whose result is read by someone other than a human, the consumer and the form are named. The reason for the choice is written as one line into the card's history — so that `Core` can check the choice.

---

## 8. Proposal: how to build the choice into the engine

### Where in the chain

| Point | What happens |
|---|---|
| Task opening, before the first call | `Intent` chooses the route of a single task (or the `route-8` mode for a goal) |
| Slicing a `route-8` segment | `Spec` proposes a route on each card; `Kit` refines by arsenal; `Intent` approves the segment map |
| Segment boundary | the next segment's routes are corrected by facts |
| Cycle closing | `Core` checks the choice by numbers and proposes a rule amendment |

### Who decides

| Who | Role | Why |
|---|---|---|
| `Intent` | chooses on a single task; approves the segment map at scale | holds the image and "cheap"; sees the task whole |
| `Spec` | proposes a card's route during slicing; builds dependencies and waves | after slicing knows the most about the card and the links between cards |
| `Kit` | refines: kit exists or not, who executes; draws up the launch plan by waves | knows the arsenal and the resources |
| dispatcher (script or `Intent`) | launches by the plan, deciding nothing | calling a node is mechanics |
| the human | approves routes without `Spec` (`route-0`…`route-5`) and the segment map at presentation | when the acceptor writes the criterion, the independent eye is only the human's |
| `Core` | checks the choice | the rule learns from numbers |

### Where things live

| What | File | Who writes |
|---|---|---|
| Law: choice points, who decides | `AGENTS.md` §2 — section "Route choice" | the human, via a "3. Form" card |
| The choice rule (section 7) | a new on-demand file `route-choice.md` — `Intent` and `Spec` read it only at the moment of choice | `Intent`, via housekeeping |
| Rationale | this file | — |
| Which routes are enabled, the "small task" threshold, `over-2`/`over-4` on/off | `project/PROJECT.md`, section "Routes" | the human, before the start |
| An epic's default route | `PROJECT.md`, "Project epics" — a "route" column; replaces the `/Intent+Kit` marker in the name | the human |
| The choice for a specific task | label `route-N` and `over-N` + a reason line in `## History` | `Intent` or `Spec`; flag `--route N` in `new-card.cjs` |
| A `route-8` segment's route map | the goal's `GOAL.md`, section "Segments" | `Spec` proposes, `Intent` approves |
| The `over-1` kit library | `project/CONFIG.md`, section "Kits by task kind" | `Kit` |

**Why a label and not a separate configuration file:** the choice belongs to the task and lives with it. The label is visible on the board; by it `sync-engines --check` catches a route without `Spec` lacking the human's approval in the history, and `Core` counts spend by route.


---

## 9. Data: what to add to the card, the law and the configuration

### Board limitation

The `kanban-markdown` extension (LachyFS, 1.14.1) **rewrites the frontmatter with a fixed set of keys** on every save from the board: `id, status, priority, assignee, epic, dueDate, created, modified, completedAt, labels, order` (`serializeFeature`). Any other key in the frontmatter is erased. Hence:
- **do not add** new frontmatter fields;
- machine-readable route data — **labels** (the board keeps `labels`);
- the explanation — a line in `## History`.

### Card — new labels

| Label | How many | Who sets it | Meaning |
|---|---|---|---|
| `route-N` | exactly one | `Intent` (single task) or `Spec` (a `route-8` segment) | route: `route-0`…`route-8` (section 3) |
| `over-N` | zero or more | `Spec` or `Kit` | overlays: `over-1`…`over-4` (section 3) |
| `seg-N` | one, only in `route-8` | `Spec` | the goal's segment number |
| `wave-N` | one, only in `route-8` | `Spec` | wave number inside the segment |
| `after-card-NNN` | zero or more | `Spec` | dependency: the card starts after card-NNN is accepted |
| `trial` | zero or one | `Spec` | trial card of a kind (`over-3`, `route-8`) |

The mandatory goal label `goal-*` (§6) stays alongside.

### Card — history lines

| Event | Who writes | Example |
|---|---|---|
| route chosen | the chooser | `` `Intent`, YYYY-MM-DD: route route-2 — brief in an accepted document, standard kit. `` |
| route changed | the changer | `` `Kit`, …: route route-2 → route-5 — site access needed. `` |
| approval of a route without `Spec` | `Intent`, on the human's reply | `` `Intent`, …: human approved the five fields and the route, 0 tokens, 0 s. `` |
| waves rebuilt | `Spec` | `` `Spec`, …: wave-2 → wave-3 — dependency on card-NNN was not named. `` |

### Law — `AGENTS.md`

| Section | What to add |
|---|---|
| §2 "Route" | a section "Route choice": choice point (before the first call); who chooses (`Intent` on a task; on a segment `Spec` proposes, `Kit` refines, `Intent` approves the segment map); routes without `Spec` — only with the human's approval; the dispatcher decides nothing; a deviation from the plan is a return along the route |
| §2, events table | "dependency not named in the plan" → `Spec`; "resource not shareable inside a wave" → `Kit` |
| §6 "Card" | labels `route-*` (exactly one, from the date of introduction), `over-*`, `seg-*`, `wave-*`, `after-card-*`, `trial`; the reason for the choice in the history |
| §7 "Board" | the `/Intent+Kit` marker in an epic's name is replaced by the epic's default route from `PROJECT.md`; wave gate: a card of wave N+1 is not taken into work until its `after-card-*` are accepted |
| §3 "Thresholds" | the "small task" threshold for `route-0` and the `over-4` batch size — in `PROJECT.md`, not in the law |

### Roles

| File | What to add |
|---|---|
| `on-demand/route-choice.md` (new) | the choice rule (section 7), label codes, when each overlay applies; `Intent` and `Spec` read it only at the moment of choice |
| `intent.md` | a link to `route-choice.md`; approval of the segment map; the wave gate |
| `spec.md`, `on-demand/spec-route8.md`, `on-demand/spec-trial-pilot.md` | on a `route-8` goal: segments, dependencies, file overlaps, waves, trial cards, the proposed route of each card; the segment slicing sits in `spec-route8.md`, the trial cards in `spec-trial-pilot.md` |
| `kit.md`, `on-demand/kit-route8.md` | launch plan by waves; the right to lengthen a route; spreading by resource inside a wave; recording a kind's kit into the library (`over-1`); the launch plan, resource spreading and kit recording sit in `kit-route8.md` |
| `core.md` | reading spend and returns by `route-*`, by waves and segments; proposing a rule amendment |

### Configuration — `project/PROJECT.md`, new section "Routes"

| Field | What it sets | Who |
|---|---|---|
| Enabled routes | which of `route-0`–`route-8` are allowed in the project | the human, before the start |
| Small-task threshold | up to what size of work `route-0` is allowed (e.g. one edit in one file) | the human |
| Overlays | `over-2` on/off and which model; `over-4` on/off and batch size | the human |
| Parallelism | how many `Run` at once in a wave | the human |
| Dispatcher | Workflow or `Intent`; from what number of segment cards — Workflow | the human |
| An epic's default route | a column in "Project epics" | the human |

`project/CONFIG.md` — section "Kits by task kind" (`over-1`): kind → role, skill, tool, access, model; date and source card. Kept by `Kit`.

The `GOAL.md` of a `route-8` goal — section "Segments": segments → waves → cards → executor. `Spec` writes the waves, `Kit` adds the executors, `Intent` approves.

### Tools

| Script | What to change |
|---|---|
| `new-card.cjs` | flags `--route`, `--over`, `--seg`, `--wave`, `--after`, `--trial` → labels |
| `sync-engines.cjs --check` | exactly one `route-*` on a new card; a route without `Spec` lacking a human-approval line → breach; `after-card-*` points to an existing card; a dependency not from an earlier wave → breach |
| `check-card.sh` | the same checks at the moment of writing |
| `tally.cjs` | spend, returns, share of preparation — by `route-*`, `over-*`, `seg-*`, `wave-*` |
| dashboard | spend broken down by route; per segment — the waves and their status |
| dispatcher script (new) | reads the segment's labels, builds the order, launches a wave, waits for acceptance |

