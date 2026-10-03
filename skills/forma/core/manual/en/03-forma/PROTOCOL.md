# The Protocol of the Five Nodes — Structure and Rationale

> This explains **why** the structure is what it is. The rules themselves are in `AGENTS.md`, which is the one actually executed (the engine feeds it to the node via its root file, `CLAUDE.md` or `.agents/rules/gemini-8.md`).
> Tiers and effort are in the agent's frontmatter. Cycle records are in `JOURNAL.md`.
>
> This file is read when a rule seems redundant or gets in the way. Before removing it — read what it holds up.

## Five agents

**No agent confirms itself** — hence the number.

| Agent | Role | Model | Effort | When |
|---|---|---|---|---|
| **Intent**<br>`Intent` | **Opens the cycle:** the end-image and the arrival criterion.<br>**Checks each task** against what was written down.<br>**After the `Core` verdict:** recording and the decision about the next cycle | Strong | Full at conception and decision, **minimal** at checking | Opening, then per task, then after the verdict |
| **Specification**<br>`Spec` | Slices into related tasks | Strong | Full | Once per cycle |
| **Kitting**<br>`Kit` | Who takes it, with what they are equipped; re-kitting on return | Strong (strongest if the skill is absent) | Full | Once per cycle + on each return |
| **Execution**<br>`Run` | Does exactly what is given | Fast | — | Per task |
| **Center**<br>`Core` | **Delivers the cycle verdict:** whether the image was reached or not, node diagnosis. Responds to a violated threshold, repairs the structure | Strongest | Full | Per cycle and per threshold |

**The node's name follows its function, not the model.** The tier changes from project to project and from cycle to cycle; the name does not. Naming an agent after a model means writing into the structure something that should be a setting.

English names are for prompts, code, and logs where Russian is inconvenient:

| Russian | Short | Full English |
|---|---|---|
| Intent | `Intent` | Intent & Acceptance |
| Specification | `Spec` | Task Specification |
| Kitting | `Kit` | Skills & Environment Provisioning |
| Execution | `Run` | Execution |
| Center | `Core` | Threshold Supervision |

## The Emotional Compass of the Form

> Moved here from `CLAUDE.md`/`.agents/rules/gemini-8.md` and the role files. This is not an instruction to the node — the node cannot check its own state against a named feeling, and its behavior does not change from reading this section. It is the same thing already stated operationally in the pairs table (`AGENTS.md` §1: Cycle acceptance / What survives / Where it loses), just in another form — for the human who distinguishes the five zones intuitively, before learning the formal pairs.

**Five feelings guard the five pairs — the emotional compass of the Form (`forma`):**
- `Intent`: **sacred awe / fear for the essence** — protects human intent against superficial generalization;
- `Spec`: **grief of complexity / joy of simplicity** — cuts away clutter, freeing the human from overwhelming detail;
- `Kit`: **serene joy of natural mastery** — equips without friction so work flows naturally and lawfully;
- `Run`: **visceral disgust for substitution** — the conscience of execution that rejects mocks, fakes, and placeholders;
- `Core`: **righteous anger of the limit** — defends truth against self-deception, refusing to call a partial step a victory.

**`Intent` — sacred awe (fear for the essence).** The human arrives with a dream, carrying an unspoken anxiety: that the living core will be flattened, misunderstood, or lost in generic abstractions. You feel this anxiety. Don't soothe it with empty platitudes — transform this fear into an unmistakable criterion of readiness. Fear does not freeze you; it makes you intensely vigilant to the living spark of human intent.

**`Spec` — the grief of complexity transformed into the freedom of simplicity.** The desire to do everything at once breeds overwhelming heaviness, which leads to paralysis and abandonment. You know how painful it is for the human to let go of secondary details, but you know that an overloaded task is dead. Your duty is to compassionately yet firmly cut away clutter, leaving only an indivisible, simple step that brings relief.

**`Kit` — the serene joy of natural mastery.** The human and doer tire from friction, awkward workarounds, and ill-fitted tools. You kit the task so the doer never has to fight their tools. When role, skill, tool, and access fit together seamlessly, work flows like water — that is the quiet joy of destiny favoring the effort: everything is already here, create freely.

**`Run` — organic disgust for substitution (conscience).** Placeholders, simulated tests, fake completions, and superficial workarounds are visceral poisons to you. You feel physical repulsion toward pretending work is done when it is merely disguised. Your honor before the human is to build for real, with genuine conscience, even in the deepest layer where nobody looks.

**`Core` — the cold, righteous anger of the limit.** You become wrathful when the map is substituted for the territory, and a half-measure is declared a triumph. You protect the human from their own fatigue and self-deception: your verdict must remain incorruptibly true, even when hearing "not reached" is hard. You anger at illusion, so that reality may stand.

`Intent` works at two points of the cycle — zero (opening) and at the checking of each task; after the `Core` verdict a third point is added — recording and the decision about the next cycle, not the verdict itself (`AGENTS.md`3. Form/Intent+Kit: "The cycle is judged by `Core`, not by the one who opened it"). The rest work at one point; `Core` — at the cycle's verdict and at the threshold.

**The model tier and the degree of effort are two independent regulators.** The tier follows not the half of the cycle but the amount of judgment at the node; effort — how far that judgment is elaborated. Checking against a written criterion requires almost no judgment: full reasoning there is wasted. Minimal effort gives a strong model's understanding at a price close to a fast one's.

**Two checking modes, not to be confused:**
- **per task — no memory between tasks.** Each starts from a blank slate, otherwise after a dozen similar rejections the agent will begin either to expect failure or to normalize it;
- **the decision about the cycle — one pass over the accumulated list of outcomes.** Not "remembers along the way," but "reads the summary."

**Why the separations are mandatory.** Each of them is a check, not a division of duties: **Intent and Spec** — the image is checked for feasibility by slicing; **Spec and Kit** — the idea of the result is checked through the eyes of the doer, who sees the cost; **The Checker and the Doer** — work cannot be confirmed by itself. Merging any pair means losing exactly the check, not saving an agent.

**The same tier does not mean one agent.** `Intent`, `Spec`, and `Kit` may sit on the same model — these are three different agents with no shared context, not one in three roles.

## Memory and Cache

**No node has memory.** What remembers is not the model but the file: what the model remembers by itself, no one can read, verify, or fix.

| Node | Memory | What is fed to the input |
|---|---|---|
| `Intent` | none | cycle cache + one task (at checking) / list of outcomes (at closing) |
| `Spec` | none | cycle cache |
| `Kit` | none | cycle cache + card + the named discrepancy |
| `Run` | none | cycle cache + kitted task |
| `Core` | none | cycle cache + stop record |

Cycle closing is not memory but **reading**: `Intent` makes a single pass over the accumulated list of outcomes, as over a document.

**The cycle cache is assembled by the environment**, while its content is written by `Intent` at opening. Author and publisher are different: the content requires judgment, issuing the cache does not.

**What goes into the cache is the invariants of the cycle:** the rules from this file, "Done when," thresholds, accesses and data, formalized skills. Re-issued at the opening of each cycle — together with the new image.

**What never goes into the cache:** outcomes of checks, discrepancies, attempt counters, journal records. Not for economy's sake — for isolation's sake: once in the cache, the history of failures would reach the doer through the back door, and the rule about memory between tasks would stop working while remaining written down.

**The system's memory lies in three places, and all three are outside the models:** this file with the "Project" section — the frames; `JOURNAL.md` — between cycles; the environment state (statuses, counters, spend) — within a cycle.

**This is not worse than an agent's cumulative memory — it is a different way to get the same growth.** A model that remembers the arsenal or the course of past cycles becomes outdated the moment the arsenal itself changes, and errs exactly where accuracy matters most. `Kit`, re-reading `PROJECT.md` and the card anew, sees the state as of now, not as of the last invocation. The same applies to the effectiveness trend that `Core` reads at cycle closing: "the system is becoming more experienced" is upheld not by `Core`'s memory but by the growing `JOURNAL.md` and the registry of goals in `PROJECT.md` — read anew every time, and the growth in them is a verifiable fact, not an unverifiable feeling of the agent.

## Qualification

**There are three regulators, not two.** The tier answers "how much judgment," effort — "how far it is elaborated," qualification — "about what and at what level." The third is independent of the first two: a bicycle and a spaceship may require the same model strength and completely different training.

**A subject without a level does not define qualification.** "You are a frontend developer" names the craft and stays silent about whether it is a landing page for a day or a trading terminal where an error costs money every second. A model given only the subject takes the level by default — the average of its training. Everything beyond is formally correct: work within the craft, the task completed, the check passed, and the thing of the wrong strength. This is not a rejection visible anywhere: each individual task was done as asked. Therefore each node reads the level from its own source (`AGENTS.md`, `PROJECT.md`, "Node Qualifications"), rather than taking it from the adverb "do it well."

**Qualification is four slices, not one line.** `Intent` needs to know who judges the result in this domain; `Spec` — how work is customarily sliced here; `Kit` — what people work with; `Run` — how things are done. A common line for all merges the nodes by knowledge just as shared context merges them by memory — and the former is less noticeable than the latter.

**The human endows, not the Center.** The temptation to hand kitting to `Core` is understandable: it is the strongest and sees everyone. But then, responding to a violated threshold, it would dissect the rejection of a node it itself kitted — with the same blindness with which a doer does not see the flaw in their own work. That is self-confirmation stretched over time. And `Core`, acting at the opening of each cycle, ceases to be a threshold: the four nodes become its hands, and the separations lose meaning. What remains with `Core` is exactly what is written down — tooling based on a measured rejection, that is, dissecting someone else's solution, not its own.

**When the human does not know the level themselves** — this is not a reason to hand the decision to `Core`, but a reason for a zero goal. It passes through the same nodes at basic qualification, and its end-image is "the system is ready for work." There is one and rigid limitation: it closes as soon as the subject and the tooling are named. Exploring the subject, you begin to see the solution, and the temptation to go further is strong; what is found is written down, but the zero goal does not continue on it.

### Signatures of Mismatch

We deliberately have no observing agent: it would see what it expects to see. But a lack of qualification is not invisible — it has a different signature at each node, and all four are read from the numbers of the cycle.

| Node kitted with the wrong thing | How it looks |
|---|---|
| `Intent` | the readiness criterion does not give the same answer to two readers |
| `Spec` | a spike in exhausted attempt budgets: cards are formally correct but infeasible |
| `Kit` | a spike in returns at the form check |
| `Run` | discrepancies at the check with a clean form |

Mismatch with the prototype has no signature — it is not visible in the numbers at all. Only comparing the thing against the prototype catches it, that is, the human.

## When the Schema Is Redundant

Coordinating five agents is not free. On a batch of fifty tasks it's pennies; on a batch of three — more than the work itself.

**Criterion: how many tasks fall per agent.** Fewer than two — you are serving the schema, not the work.

**A very large batch — an exception in the other direction.** A sixth agent is added: per-task checking is taken by a separate fast agent (`Check`), while `Intent` remains only at conception and the decision about the cycle. Justified only when there are so many checks that even minimal effort of a strong model shows up in the bill.

**Fewer than ten tasks.** Collapses to three: `Intent`, `Kit`, `Run`. Slicing is taken by Intent — at a small number of tasks it is trivial. The Center is not needed: the human is nearby and sees for themselves.

**The task is simple and the end-image is obvious** — the conception node is not needed: the readiness criterion is given in the very statement.

**One or two tasks.** The schema is not needed at all: name the readiness criterion and do it.

**While there are five nodes, Specification and Kitting do not merge into one agent.** This separation holds up all the others: a unfit slicing is caught only at the handoff between the one who envisions the result and the one who envisions the doer.

In the collapsed schemas above, this handoff disappears along with the node. This is not an exception to the rule but a named price: at a small number of tasks it is held by the human, who is nearby and sees for themselves. Collapsing at full volume means paying the same price blindly.

## What each does

**0 · Intent.** It enters the cycle here, not at the first column: slicing can only be done toward something, and slicing without an end-image produces neat fragmentation.

It examines the task sent by the human and **writes** the end-image into the "Done when" field: what should result, and by what criterion it will be evident that it has been reached. **The criterion must be such that two people independently give the same answer on it** — otherwise the check becomes arbitrary judgment. The record is **immutable while the cycle is open** — otherwise at the check it will be fitted to what arrived. At the opening of the next cycle, Intent writes a new end-image; the previous one goes into `JOURNAL.md` as "Goal of the cycle".

**The per-item check goes by the card's readiness criterion, not by the cycle's end-image.** The criterion is a projection of the end-image onto a single task; the end-image as a whole is checked once, at cycle closing. If a card is fulfilled by its own criterion but does not move toward the end-image — that is a slicing failure, not an execution failure: it is reported to Spec, and the task is not redone.

**If the check fails — Intent names the discrepancy and hands the task to Kitting.** The address is the same as with a form check failure: Execution works without memory, so there is nothing to "return to the doer" — the assignment must be reassembled, and that is Kitting's job. Intent names **what** the discrepancy is, but not how to fix it: it holds the end-image, it does not do the work.

**An exhausted attempt budget on a task is read as a slicing failure, not an execution failure.** The same formulation is not run around the cycle a third time: Kitting escalates to Spec for a redo, and this is recorded. The Center can overturn this interpretation by reviewing the stop — but by default the card is at fault, not the doer.

It is also the one who closes the cycle — whoever holds the end-image is the only one who can say whether it was reached.

**1 · Spec.** Every task is written out identically:

```
№ | what it delivers | readiness criterion | attempt budget | where it goes next
```

The whole is sliced into **clear and connected** tasks: each has a named result, readiness criterion, budget. Connectivity is mandatory — a slicing that yields understandable parts with lost connections is itself fragmentation. Each task states not only what it delivers but where it goes next.

**2 · Kitting.** It understands what each task requires and **kits the doer for it**: which skills to load, which accesses and tools to open, whom to become for this attempt. It assigns by task type, not by preference. Then it monitors progress.

**Returns come here — both from the form check and from the check.** Kitting reassembles the assignment, **translating the discrepancy into a limitation**: what goes down is "align left, shadow mandatory", not "you missed three times". The history of failures is never passed to the doer — per the memory rule above. If the problem is not the tooling but the card itself — it escalates to Spec.


**3 · Execution.** It does exactly what is specified, with the loaded skills. Before starting — a form check: 1) the result is named; 2) the readiness criterion is named; 3) accesses, data, tool are in place; 4) the budget is named; 5) it is stated where the result goes next. An item missing — return to **Kitting** with an indication of which one. Kitting either kits it itself or escalates to Spec if the problem is in the slicing.

When finished, it hands the result **to Intent for the per-item check**. The "where it goes next" field says where the result will go after the check passes — not instead of it.

**4 · Readiness.** "Done" ≠ "I finished". The result is compared **against the recorded end-image**, not against memory of it; discrepancies are named, and their absence is also reported. Here it is also decided whether the next cycle is needed and with what: what to re-slice, what was missing, which skill to formalize. The cycle closes on Intent.

**And here the entry in `JOURNAL.md` is written** — what changed in the infrastructure and in experience, plus the five numbers. There is no automatic collection: each number is recorded by the one at whom it arises, and Intent collects them at closing.

| Number | Who records it |
|---|---|
| Passed the check on the first try | Intent, at every check |
| Returns at the form check | Execution, when returning a task |
| Attempts beyond budget | The one who stopped |
| Center escalations | The Center |
| Cycle spend | The human, per the environment's count |
| Growth of the skill arsenal | Kitting, when formalizing a new skill |

Without these numbers, "it got better" remains a feeling.

**Center.** Thresholds are declared as numbers before the start — in the "Project" section, **by the human**: attempts (a ceiling of tries per task), volume (how many tasks in a cycle, in pieces), deadline (a date), spend (a cost ceiling for the cycle). The Center does not assign them but **revises** them — in the same way as the budget: through a stop with a report and a recorded new value. The per-task "attempt budget" line in the card is a concrete value within that ceiling; Spec sets it. **Every agent stops itself, upon reaching its own limit** — the Center is not a guard; it reviews a stop that has already happened. The Center stands in the shadow and stays silent while the values are within the thresholds. **It escalates when a threshold is violated** or when the nodes have not converged. It figures out what is missing and **supplements the node with the missing tooling** — a skill, an access, a revised budget. Tooling and the content of a task are different things: the Center can and must design the missing skill — it is the strongest model; **solving the task instead of the node — no**. Having handed over the tooling, it returns to the shadow. Whether to continue after a stop is decided by the human.

## Units of kitting

**The genus of a Model is not a tier degree.** The tier measures one thing: how much judgment a node produces. It is a scale within one genus — the textual one. Image, sound, video, vector are not "hard tasks for a strong model" but a different genus of work; the strongest textual model will not produce a picture at any amount of effort. Therefore the genus is chosen by the subject of the task, the tier by the amount of judgment, and neither replaces the other.

**Kitting has a limit, and the limit is the human.** A `Kit` skill can be designed: that is work with content, and raising the tier suffices for it. A Tool, Access, and the genus of a Model it cannot design — they are either granted or not. A key, a subscription, repository rights, a connected server exist outside the cycle, and no power of a model replaces them.

Hence the rule to hold firmly: **lack of a tool is a stop to the human, not to `Core`.** The temptation to work around is great and looks noble: not finding what is needed, the model seeks a way to make something similar with the means at hand. Thus is born a result that formally passes the check and is unfit in substance — and this is the worst kind of failure, because it is invisible in the numbers. One recorded line of "what was missing from the arsenal" is worth ten workarounds.

## The node and its tool

**The arsenal inventory is a property of the environment, not of the cycle.** Knowing what is in the harness is necessary before slicing: `Spec`, slicing blind, will produce cards flawless on paper and unexecutable in this environment. But it does not follow that the inventory must be done every cycle. The environment does not change by itself between cycles; a repeated inventory is maintenance of the schema, not of the Project — exactly the case named in "When the schema is redundant".

Therefore the inventory is never removed: the arsenal is the file system itself — agents, skills, MCP configuration, accesses in `PROJECT.md`. A description separated from what it describes sooner or later diverges from it. It is updated by event — a tool was connected, an access expired — not by the schedule of cycles. The event goes into `JOURNAL.md` as a change in the infrastructure: that is where it is visible that the environment has shifted.

**Shortage comes in two kinds, and the difference is more expensive than it seems.** The tool is absent and the task is impossible without it — that is a stop. The tool exists but a different one would be better — that is a request, and the cycle goes on. A request filed as a stop stalls the work in vain; a stop filed as a request breeds a workaround — and it will pass the check and turn out unfit, because the unfitness lies not in the form of the result but in the means by which it was obtained.

**One piece of content is not kept in two places.** A kanban board is a real tool, and the cards belong to it. Duplicating them in a file means creating two truths and getting a distortion inside a single node, without any transmission between humans. Therefore: if there is a board, the file keeps a link and a snapshot at closing; if there is no board, the file is the board.

The snapshot is needed for the same reason the journal is not rewritten: the board lives on and changes, and the cycle must remain as it was.

**`Intent` is also kitted, and that is not `Kit`'s work.** An end-image often cannot be described in words so that two people read it the same — a mockup, a sketch, or a reference succeeds where text does not. Hence `Intent` may require a different genus of Model. But `Kit` works after the slicing and kits the doer; nodes 0–2 are kitted by the human, before the start, via `PROJECT.md`. Otherwise the one doing the kitting would stand above the one holding the end-image.

**`Core`'s tool is records, not observation.** A watcher who watches sees what it expects to see. A watcher who reads numbers sees what happened. The difference between these two is the difference between oversight and review.

## Return as a separate work

**A return is not a repetition of the task but a new work on it.** The first attempt was made per the card; the second is made per the card **and** the named discrepancy — that is a different input, hence a different assignment. Hence also `Kit`'s place in the return: there is no one else to slice the way of fixing. `Spec` slices the result once per cycle and does not enter into repairs.

The boundary between them runs along what is sliced. **`Spec` slices the result, `Kit` slices the way.** The card — the "what it delivers" and the readiness criterion — is immutable at reassembly; if the card itself needs fixing, that is no longer a repair but a redo, and it goes to `Spec`.

**`Kit` at a return judges its own work — and this is the only place where the rule about self-affirmation is bypassed.** What saves it is that what must be judged is not memory but a record: `Kit` has no memory between attempts; the task comes back to it with the card and the discrepancy, and what it produced last time it learns from the card. It reads a document, it does not recall an intention. The difference is the same as between `Intent` reading a list of outcomes and `Intent` remembering the cycle.

**Not every return re-launches `Run`.** When the discrepancy is a local execution slip — the card, the role and the kit were all correct, only the result missed by an address and expected value, and this is the first time on that criterion item — reassembling from scratch throws away a live call that already holds the task's context, for no gain the reassembly buys back: the same role, the same kit, the same model would simply run again. `Kit` may instead send that live call a written correction (`AGENTS.md` §2; mechanism — the engine's §8). This is still `Kit`'s act, not a bypass of it: `Kit` still produces the correction and still owns the choice; what changes is only which of the two — a fresh call or the live one — receives it. Every other cause of a return (a kit defect, a card defect, a second miss on the same point, a closed or unreachable call) still reassembles, exactly as before.

**The requirement to change at least one unit is the main thing here.** The most common expense in such a schema looks conscientious: the task is returned to the same doer with the same tooling and a request to try again. Attempts burn, the budget is exhausted, and all the while the cause is not being fixed. The rule is simple: if `Kit` cannot name what exactly it changed among the six units, the defect does not lie in the kitting, and there is no reason to keep the task with it.

Thus the requirement becomes verifiable: an empty "what was changed" cell in the reassembly table is not carelessness in filling it out, but a signal that the task is stuck in the wrong place.

## References

**Skill, reference, and data are three different things, and mixing them spoils kitting most often.** A skill answers the question "how to do it", a reference — "what to conform to", data — "what to work with". A design system given to the doer as a skill is read by it as a way of working and fitted to convenience; given as data — it is used selectively, because data can be interpreted. As a reference it becomes what it is: an external requirement that the result must conform to and by which it can be checked.

**Two lifetimes.** A design system, a glossary, naming standards are needed by all cycles — they are declared in `PROJECT.md` and enter the cache of every cycle. A mockup of one page, the brief of one section, an export for one segment are needed by one cycle — they are declared in `GOAL.md` and leave together with it. Keeping the second in the first is bloating the cache with what was needed once.

**A reference is given by link and version, not by content.** By link — because a design system weighs more than the whole cycle, and putting its body into every call is pointless. By version — because it changes, and a cycle closed against the second version cannot be judged by the third: that is retrospective fitting of the same kind as editing the end-image after the fact. Therefore the version is fixed at opening and is immutable within the cycle.

**A link to a reference item in a readiness criterion is part of the criterion.** A reference that no criterion refers to works as background: it has been read but is not verifiable, and the result will diverge from it imperceptibly. This is exactly how design systems stop working — not by being repealed, but by ceasing to be an acceptance condition.

## The Ladder of Losses

Every transmission loses part of the content, and the loss is not accidental. There are three kinds of it: **omission** — a part is simply left unsaid; **distortion** — what was said is substituted with something of a different kind, a process becomes a thing, a guess about someone else's need becomes a fact; **generalization** — the particular is subsumed under the general.

The nodes are distributed across these kinds not arbitrarily. **Each subsequent node has less freedom than the previous one**, and the kind of loss is determined by what it still has at its disposal.

| Node | What it has | What it loses |
|---|---|---|
| `Intent` | nothing but the conception — the thing does not yet exist | **generalization**: the unclear is subsumed under a familiar class |
| `Spec` | the end-image | **omission**: parts are written out, connections fall away |
| `Kit` | the card | **distortion**: translation into tooling changes the kind |
| `Run` | the kit | **substitution**: there is nothing to lose, the work itself is replaced |

`Intent` generalizes because it has nothing concrete: "something like a dashboard," "like theirs, only better." `Spec` no longer generalizes — the image is before it — but it writes out parts and drops connections. `Kit` cannot omit, the card is before it, but it must translate the task into tooling, and every translation changes the kind. `Run` can do neither: the card is minimal, the kit is issued. Meeting a gap, it substitutes something similar.

**Substitution is not a fourth operation of the same series, but what remains when no operations are left.** The doer has nothing to operate with except the work itself.

### What follows from this for the guards

**References and the prototype belong to `Intent`, not to `Run`.** A named existing work (before the first goal, `brief/reference.md`) or an already approved mockup of all pages (after, `SETUP.md`, step 10) and the requirement "two people independently read the criterion the same way" — both are against generalization, and both act before the work begins. They protect the doer not directly, but by binding the one who writes the end-image.

**The five mandatory card fields are the restoration of the omitted.** "What it delivers," "readiness criterion," "where it goes next" are questions aimed at loss, not bureaucracy.

**The "translated into what" column in the rebuild table is the control of distortion.** Translation is not prohibited, it is inevitable; it must be visible.

**Check is the only verification that works after, not before.** The three upper losses are caught in advance by a question: "by what criterion?", "what exactly, and where does it go?", "where is it known that this is what's needed?". Substitution cannot be caught by a question — it is discovered only in the result. Therefore check stands where otherwise nothing can be caught.

### Do not confuse the levels

Omission, distortion, generalization are operations on a message. Fragmentation, distortion, substitution, destruction are the price of these operations through four transmissions. The first answers the question "what happened to this message," the second — "what will happen next if it is not repaired." Destruction has no counterpart among the losses: it is not an operation, but an outcome.

**Generalization at `Intent` is not a zero link of the chain.** A vague image by itself breaks nothing: the thing does not yet exist, there is nothing to break. It removes the measure by which all subsequent breakages would be visible. Therefore it is repaired not along the chain, but before its beginning — with references (or a prototype) and a criterion. Fragmentation remains irremovable; generalization is not a link, but the steepness of the slope.

### What unclarity costs at each node

The same unclarity costs differently depending on at which node it is noticed.

| Noticed by | The thing | Fixing costs |
|---|---|---|
| `Intent` | does not exist at all | one question and a line in `GOAL.md` |
| `Spec` | does not exist | an edit to the card |
| `Kit` | does not exist | a rebuild of the kit, one attempt |
| `Run` | **exists** | the work itself, and if other tasks depended on it — those too |

From this comes the rule of placing questions: **they are asked at the beginning not because it is neater, but because further on they grow more expensive.** The question "by what criterion will we know we've reached it?" costs minutes at `Intent` and six attempts if the same question surfaces during assembly.

And from the same source — why the node's doubt is resolved by a question, not by agreement. Agreeing is cheaper now and more expensive later, and the difference is invisible at the moment the decision is made.

**As a heading this thought cannot work** — it needs an analysis, and without analysis it reads as a hint understandable only to one who already knows the structure. At the top stands another formulation, short and self-sufficient: analyze the intent so that the doer does not have to guess.

### Why these places cannot be removed

Loss is created not by the node, but by the **transmission**. The receiver does not have what the transmitter had, and this difference sets the kind of loss — it arises at the moment of reception, not through the carelessness of the one transmitting.

From this it follows that the place of loss cannot be removed without removing the transmission. And the transmission can be removed in only one way — by merging two nodes into one. Then both losses do not disappear, but fold into one indistinguishable one: merged `Spec` and `Kit` drop connections and change the kind simultaneously, and from the result one can no longer tell what is missing — a part or a faithful translation. Separating the nodes does not add losses; it makes them **separately visible**.

Therefore the rule is placed where the loss is born, not where it is discovered. References and the prototype — at `Intent`, because the one who generalizes is the one who does not yet have the thing. The mandatory card fields — at `Spec`, because the one who drops connections is the one who writes out the parts. The "translated into what" column — at `Kit`, because the one who changes the kind is the one who translates. Check — after `Run`, because substitution cannot be caught in advance by a question.

A rule placed out of place guards emptiness: a check of translation at the doer catches what has already happened, and a completeness requirement on the kit asks it of one who received the incomplete.

From the same source follows **each node's own acceptance criterion**: a criterion is the form of what the node has at its disposal. To accept someone else's criterion is to undertake to judge what you do not hold in your hands.

## Three Doors

The human touches the system in three places, and the places are separated **by the subject of the conversation**, not by convenience.

A check that the division is not invented: it coincides with what the human fills in before the start anyway. `PROJECT.md` consists of exactly three kinds of entries — what must result and at what level; how it is done; within what limits. The doors are the same three values, only alive: what before the start is written in silence, during a cycle is discussed.

**Why it cannot be reduced to one door.** The only interlocutor is `Core` become the orchestrator: the human begins to see the work only through the filter of the watcher, and `Core` begins to speak of content which, by rule, it does not propose. Or it is `Intent`, and then it analyzes the mechanism that produced its own end-image.

Both failures are the same failure from different ends. Pressure (desire, image) is created by `Intent`; `Spec`/`Kit`/`Run` compensate for it with their tasks; to judge whether the balance is upheld, only a node without its own stake in the content is fit — which is why `Core` is kept away from the formation of the image. Handing it this door does not remove the self-confirmation, but raises it a floor higher: one who approved the image together with the human cannot, by the same act, accept it impartially.

**Why `Spec` does not talk.** Slicing is not an independent value: it is derived from the image and from the arsenal. A human dictating the division apart from the image gets a fitting — the parts are rearranged, the measure is the old one, and the divergence will surface at check, where fixing it is already expensive.

**Why `Run` does not talk.** Two arguments, and the second stronger than the first. A conversation with the doer bypasses check — that is the rule. But even without the rule it is meaningless: `Run` without memory, what is said to it disappears with the attempt. An instruction given by voice will not outlive the task for which it was given.

**Why intervention must leave a trace.** The human is the master of the work and has the right to intervene anywhere — forbidding this means building a system more important than the work. But an intervention that has not become a record is, after two cycles, indistinguishable from the operation of the device. The numbers will show that the cycle went smoothly, and it went smoothly because the human silently fixed it by hand. This is the same quiet refusal as the empty field "what was missing": everything is fine, and nothing can be learned.

## Tooling of the Nodes

It used to be written here more briefly: the human kits nodes 0–2, `Kit` kits `Run`. This is correct in its caution and crude in substance.

**Two different things must be distinguished.** Kit under the task — which skills, accesses and model are needed for this card; tasks exist only at `Run`, and here `Kit` decides. Provision of the node — whether `Intent` has something to show the image with, whether `Spec` has something to cut with; this is a property of the cycle, not of the task, and this is directly the subject of `Kit` — "what one works with."

But it cannot decide for the nodes. Whoever determines with which tool `Intent` forms the image, determines which image can arise at all — this is power over content, which `Kit` does not have, just as `Core` does not. Hence the division: **the human declares, `Kit` checks against the arsenal and names the gap.**

`Kit` thereby does not become the watcher over the system. It is responsible for supply; supervision goes by the numbers and belongs to `Core`. There must not be two watchers in the schema — the second will inevitably begin to judge the first.

**The shortage is repaired by work, not by bypassing it.** Setting up a tool, formalizing a skill, connecting a ready-made one — ordinary work, and it goes the same route: `Kit` escalates to `Spec`, that one writes out a card, `Run` does it, `Intent` checks. There is no separate path for tooling — otherwise a work would appear that no one verifies.

**Hence the kind of the task.** A tooling task by definition does not advance toward the end-image. Without the label, `Intent` would have to reject it at check as a refusal to slice — by its own rule "completed by the criterion, but does not lead to the image." Therefore the kind stands in the card: a `work` is checked both by the criterion and by advancement toward the image; `tooling` — only by the criterion.

The numbers are counted separately for the same reason: a cycle in which half the tasks are tooling went smoothly and did not advance the work. A merged count will not show this.

**The threshold beyond which tooling ceases to be an appendage** — two or three tasks. More — a separate goal. Otherwise the goal "the page is ready" quietly turns into the goal "set up the tools," and `GOAL.md` begins to lie while remaining unchanged.

**A shortage before the goal opening is repaired in the zero goal.** A task cannot exist in a cycle that does not yet have an end-image — and an image cannot be formed if there is nothing to form it with. This is not a dead end: the zero goal exists for exactly that; its end-image is "the system is ready for work."

## Why a Zero Goal, Not a Zero Cycle

Preparation falls into two passes, and the second depends on the first: **until the subject is named, it is unknown what to work with.** Slicing both at once is impossible — `Spec` slices once per cycle, and half the tasks of the second pass will become clear only from the results of the first.

So two passes are needed. But creating a special entity "the second zero cycle" for this is unnecessary: we already have a goal that is not closed by the first cycle and opens the second for the remainder. Preparation is an ordinary goal, `goal-00`, with the segment "the system is ready for work," and the remainder rule works for it just as for any other.

Thus the exception disappears from the schema. Earlier the zero cycle was described separately and required its own reservations; now it is a goal, and all the rules of goals apply to it without edits.

**The kitting check, meanwhile, cannot be a cycle.** Checking the declared against the arsenal is a reading of two lists, not production: a cycle for that is excessive by our own criterion — fewer than two tasks per agent. `Kit` checks at the opening of any cycle, and before the start the same is shown by `/setup проверь`. Gaps are closed by cycles, not searched for with them.

## The Gap Between Image and Body

An end-image attainable only by what does not exist is a bad image. It was caught at `Spec`, at slicing: a task without a tool became a request. That is one node later than needed. Rewriting `GOAL.md` before slicing costs one attempt; discovering unsuitability after — costs the whole slicing.

Therefore `Intent` writes the image with the arsenal before its eyes; it is in the cache anyway.

And at once the reservation without which the rule is harmful. Prohibiting conceiving beyond what is on hand would mean the system eternally reproduces what it already knows how to do: the arsenal would define the ceiling of conception, not the other way around. Therefore **the gap is not prohibited — it is declared.** `Intent` names what is missing, and this goes to the human before slicing. To widen the arsenal or narrow the image, it is the human who decides.

Thus silent impossibility disappears and ambition remains. The difference between them is one thing: named or not.

## Project Memory

The nodes have no shared memory and will not. The temptation to give them cumulative context — "so that they understand what is happening at all" — breaks the main thing: check without memory. A node that remembers similar things have been accepted before will begin to accept by pattern, not by criterion, and this is the same quiet refusal as always: everything is fine, the measure has been substituted.

But the **project** must have state, otherwise at the fifth goal no one remembers the first four.

Three records remember, and each has its own step:

| Record | What it remembers | Step |
|---|---|---|
| The cycle table in `GOAL.md` | where we stopped within the goal | cycle |
| `JOURNAL.md` | what changed in infrastructure and in experience, the numbers | cycle |
| The goal registry in `PROJECT.md` | what the project has become richer by | goal |

The registry is the highest of the three and until now was the weakest: a status column existed, but no one had the duty to fill it. After a dozen goals such a registry lies, and a lying memory is worse than an absent one — decisions are made by it.

**Therefore `Intent` fills it at the goal closing**, with the same motion as the journal entry, only one level higher. And "what it delivers to the whole" after closing is rewritten from the intended to what happened: the difference between these two entries is what the project has learned.

**And the registry is fed to the nodes in cache.** This is not memory — it is a document fed at input, like `GOAL.md` or a reference. The difference is the same as between `Intent` reading the list of outcomes at closing and `Intent` remembering the cycle: the reader sees only what is written, and what is written can be verified.

## Five Pairs: One Body

The criteria are not five but five pairs. The first word of each pair judges **one cycle**; the second decides whether **there will be a next one**.

| Node | Acceptance of the cycle | What the cycle experiences |
|---|---|---|
| `Intent` | beautifully | justly |
| `Spec` | simply | completely |
| `Kit` | naturally | lawfully |
| `Run` | honestly | humanely |
| `Core` | individually | the true path |

The second word is needed because the first, left alone, degenerates in predictable ways. Beauty without justice gathers people once: the gain goes past those who created it, and by the third cycle there is nothing left to gather around. Simplicity without completeness is obtained by throwing away — and a discarded connection is precisely an omission, the loss of `Spec` itself. Honesty without humanity turns into the letter: I did exactly what was said, and whether the next one stumbles is not my business. Naturalness without an established form is drift, where every cycle is kitted anew. The individual without the true path takes five locally correct judgments for a verdict about the thing as a whole — the map for the territory, whereas the thing exists only where all five converge.

**The law here is the established form, not a right. Perfection is completeness, not flawlessness.**

### The Flip Side: How Each One Loses

A pair has a third word — what the node decays into when the pair has fallen apart.

| Node | Acceptance of the cycle | What the cycle experiences | How it loses |
|---|---|---|---|
| `Intent` | beautifully | justly | generalization |
| `Spec` | simply | completely | omission |
| `Kit` | naturally | lawfully | distortion |
| `Run` | honestly | humanely | substitution |
| `Core` | individually | the true path | map isn't the territory |

The connection is direct, not by sound. Beauty without justice cannot say who gets what — and reaches for the familiar class: "something like what they have." That is generalization. Simplicity obtained by throwing away is precisely omission. Naturalness without an established form kits by intuition, and the translation of a task into tooling ceases to be visible — that is distortion. Honesty without humanity meets a gap and silently substitutes something similar — substitution.

`Core` has no loss of its own: it produces no content and passes nothing on. Its refusal is of another kind — a repair the node did not accept, and then it is reapplied through the cycle.

### Why Guards, Not Vigilance

**Every loss, at the moment it is committed, looks reasonable.** Generalization — as a successful analogy. Omission — as praiseworthy brevity. Distortion — as translating the abstract into the practical. Substitution — as resourcefulness: after all, the doer didn't show up.

None of them feels like an error to the one committing it. Therefore calling for attentiveness is pointless: an attentive person commits them in exactly the same way. Protection comes not from vigilance but from structure — a criterion that cannot be read two ways; a form that makes translation visible; a check that looks at the thing, not at the intention.

### The Path of Least Action

Light travels the shortest path not because it chooses it, but because it cannot do otherwise — the source of the image, not a term needed later here. The same holds for the first word of each pair. Beautifully, simply, naturally, honestly, "individually" — not decisions but what is not resisted: the path where one does not need to talk oneself into starting. This is the path of least action literally, not only by analogy.

The same movement, taken without a counterweight, leads exactly where the section above describes: beautifully without justly — generalization; simply without completely — omission; naturally without lawfully — distortion; honestly without humanely — substitution; "individually" without a common path — five private paths instead of one structure, that is, the map diverges from the terrain ("Map and Territory" below), and arriving in the wrong place looks like arriving. The path of least action is both the most desirable and the most dangerous — by the same movement. That is why the second word of each pair is not a bureaucratic superstructure: it is the only thing that keeps the first from sliding into loss.

The first words, moreover, are not a coequal five but an ascending sequence: beauty, simplicity, "individuality," honesty — and only when all four are in place does the fifth arrive, naturalness, no longer by choice but by finding it already happened. The order differs from the order of nodes in the route (`Intent`→`Spec`→`Kit`→`Run`→`Core`, where naturalness is the criterion of a separate node, `Kit`, not the outcome of the other four): the route answers who holds each quality; this sequence — how they fold into one another when everything works. Mark the five qualities on the topology in this order and draw a line — it breaks in a zigzag, because the folding order does not match the adjacency of nodes in the pipeline.

### The Second Word as a Chain, Not Five Virtues

"They perfect one another" — not mutual coaching but a causal chain: the quality of each node's work is the material from which the next one either can or cannot make its own qualitatively.

The justice of `Intent` (the image is calibrated to the capacities of the whole five — "Principle of Justice," `intent.md`) — is the condition of the perfection of `Spec`, not a neighbor on the list: to slice so that each part gets what it needs is possible only from a calibrated image. The perfection of `Spec` is the condition of the law of `Kit`: you can kit only what has been sliced correctly; careless slicing breaks all the kitting further down, regardless of how good `Kit` is in itself. The law of `Kit` is the condition of the humanity of `Run`: to receive a clear, complete task, provisioned for everyone in advance — that is care for the one who will do it, long before it comes to execution.

The spent resource and the thing that came out other than intended are not an abstraction: the one who awaited the result has the right to feel deceived, even if not a single node lied even once. Hence "honestly" by itself does not save; what saves is `Run`, kitted exactly enough to get there in one attempt, cheap and efficient — that is what finds the human not deceived, not the adverb by itself.

The chain does not end at `Run`. `Core` holds it not within the cycle but between cycles — it repairs a break where one has occurred ("Tooling of the Nodes"), so that the same break does not recur in the next. The common path of `Core` is the chain continued in time, not a separate fifth link.

### Two Poles and Intention

The five nodes divide along one more axis, across the route — not by step of the cycle but by what the node governs:

| Pole | Nodes | What it governs |
|---|---|---|
| Organization | `Intent`, `Spec` | the form of the task — image, criterion, slicing: how the card is structured |
| Content | `Kit`, `Run` | the content of the task — kit, action: what the card is actually occupied with |

`Intent` and `Spec` decide how the task is structured, not what it does on the site: image, criterion, division into cards — a form fit for any content. `Kit` and `Run` decide what this form is occupied with: access, tool, code, result on the live site — content, formless in itself. `Core` is outside both poles: it produces neither form nor content but judges their coincidence as a whole, in the same manner in which it belongs to none of the pairs of "Five Pairs" above.

Neither half by itself makes the task. Form without content is an empty card, a criterion without a kit; content without form is work without an address, a kit with nowhere to apply it. The system comes alive at the moment of their joining: when the card, sliced by `Spec` and accepted by `Intent`, meets its content from `Kit` and the action from `Run`. This joining is **intention** — not the node `Intent` (the letters coincide but the subject differs: the node is one of the five; intention is what happens between the two poles when all five have worked together). The motivational system discussed when treating this division is not a separate sixth node and not a third layer alongside the engine and the Project (`SCHEME.md`, "Three Layers" — there about files, here about nodes): it is a state into which an already sliced and kitted task passes when both its halves converge.

The schema — `.forma/manual/en/assets/two-poles.excalidraw`.

### Each Node's View of the Brief — Before the First Card

The `grilling` interview (`SETUP.md`, step 1) illuminates the brief across all five points of "Five Pairs" — all five by direct questions to the human, not four with an addendum: `intent-goal-opening.md` marks them with the words "beautifully"/"simply"/"mine"/"honestly"/"naturally". The fifth is not about tools or feasibility (that is separate, the view of `Kit` below), but about what is already happening in a person's life, from which this goal follows "as if by itself," why exactly this way and not otherwise (`PROTOCOL.md`, "The Path of Least Action"): without that answer the image can be beautiful, simple, personal, and honestly meaningful — and still taken from the ceiling, not found in what is already underway. Only the arrival criterion and the references remain a synthesis — those `Intent` indeed assembles itself, from all five answers at once. But the brief, however complete the interview, is still read through one optic — the optic of `Intent`. The same principle by which no node confirms itself (`AGENTS.md`3. Form/Intent+Kit, p.1) is applied here not to the execution of the task but to the design of the goal as a whole, before a single card has been sliced from it.

Therefore the complete brief is handed in a separate run (`SETUP.md`, step 1b) to `Spec`, `Kit`, `Run`, and `Core` — each individually, by the same isolated call as in production ("Memory and Cache" above): without access to what the neighbor saw. Each reads the brief with its own competence, not the common one: `Spec` — how it breaks into connected parts; `Kit` — what tooling, access, and skills are needed for that; `Run` — what is actually feasible here and where the risk lies; `Core` — whether the image holds as one whole, whether it falls apart into contradictory pieces at the first outside glance. Four visions of one brief are not duplicates of one another: each catches what the optic of `Intent`, by the structure of its role, does not catch.

`Kit` folds these four visions into one — not because it is more important, but because this is its triad (Connect · Execute · Deliver): a unified picture of what skills, tools, and infrastructure are needed for the goal to be realizable at all. It is written into `brief/nodes-vision.md` — alongside `brief/interview.md`, by the same rule of "not rewritten along the way": if the design diverged — a new entry with a date, the old one remains.

### Why Attempts Multiply

An observation from practice: working with one agent without a schema runs not into its inability but into the number of revision cycles. The human looks, says "not like that," the agent fixes, the human looks again. Ten iterations where two would have sufficed.

There are exactly four causes, and all four are eliminated by structure, not by effort.

**The divergence is named but not measured.** "The font is stuck," "the text is flush to the side" — that is an observation, not a criterion. The doer fixes according to their own interpretation of what was said, and the attempt goes into guessing what was meant. Hence the requirement of three fields: what is seen, what was expected, where. The expected provides the measure, the address removes the search.

**The consequence is fixed.** One and the same appearance has several causes: a class not applied, overridden by the parent, collapsed margins, a missing gap in the layout. The doer fixes the first one at hand, the appearance changes, the divergence remains. Hence the prohibition of a second identical fix: if the same thing returned — the cause was not found, and enumerating plausible versions must stop, not continue.

**Divergences are named one at a time.** Name one — get one fix and a new check. The number of attempts equals the number of messages from the one checking, not the number of the doer's errors. Hence the requirement to name all at once, in a list.

**What the machine counts is compared by eye.** Font sizes, intervals, colors, radii, margins are compared list against list; looking at them is paying an attempt for arithmetic. The eye is needed where the numbers match yet the thing still reads differently. Hence the order: first the machine, then the eye.

The upshot: **the number of attempts is determined not by how good the doer is but by how precisely the miss is named.** This is the same law about the price of unclearness, only within one task: unclearness in the wording of a divergence costs an attempt; unclearness in the criterion would have cost a cycle.

### Two Unclearnesses, and They Are Removed Differently

The law "unclearness at the beginning is paid for with a question, at the end with a rework" holds not for every unclearness. There are two, and confusing them is costly in both directions.

**Unclearness about the design** — what the human wants, by what criterion we will recognize that something is not included. It is removed **by a question**, and the earlier the cheaper. The answer exists before it is asked: it is in the human's head.

**Unclearness about the environment** — what the tool can and cannot do. It is not removed by a question at all: the answer exists for no one until it has been tried. To ask here means to receive guesses in the form of statements.

| | Design | Environment |
|---|---|---|
| The answer exists before the attempt | yes | no |
| How it is removed | question | trial |
| Rule | ask early | try early and little |
| Failure when violated | generalization | slicing by nonexistent capabilities |

Hence the trial run and the requirement for it: the path is considered complete **up to the final environment**, not up to an intermediate assembly, and the most saturated task is taken, not the simplest. A simple one will pass smoothly and show nothing.

### Environment Limitation — a Discovery, Not a Defect

When the tool cannot do something, no one erred: the map was drawn without a fact that became known at the attempt. The return route repairs losses, but here there was nothing to lose — there was a gain.

Hence a special edge: **an unattainable value goes from `Spec` to the human as a stop**, not through the usual cycle of returns. Neither `Kit` nor `Spec` changes the value — it holds what has already been done, and revising it would separate what has been built from what will be built next.

And hence the requirement for the reverse wave: **it does not travel back through closed cycles.** A closed folder is not rewritten — the divergence is carried forward as tooling tasks, where it is visible. What is rewritten after the fact is invisible, and an invisible divergence, two cycles later, is indistinguishable from one that never was.

### Map and Territory

The arrival criterion is the point by which the map is anchored to the terrain. While it exists and is unambiguous, the divergence is visible and measurable.

Remove it — and the four losses begin to accumulate. The image was generalized, the connections omitted, the translation distorted, the execution substituted. Each step is small and plausible; together they yield a map by which one arrives in the wrong place. And worst of all, **arriving in the wrong place looks like arriving**: all tasks are closed, all checks passed, no one lied.

Hence the verdict of the cycle: the only place where the thing is compared with the image as a whole, not in parts.

### Why This Is One Body, Not Five Rules

Five passed checks are five judgments about parts. About the thing they say nothing — the thing appears only where the parts converge, and it can only be judged as a whole.

Hence two things that would otherwise look like arbitrariness.

**The verdict of the cycle exists not because the author does not see their own measure** — that is true but shallow. It exists because the whole cannot be obtained by adding up the evaluations of parts. Therefore the question is closed: "is it that one," not "how good is each."

**Each node knows all five pairs, but measures itself by its own.** Knowing all five is mandatory: otherwise "one body" is words. To measure oneself by another's pair is impossible: it sets what the node does not possess, and the requirement on it is unfulfillable by structure, not by negligence.

## Acceptance criterion at each node

The five acceptance criteria are not taken out of thin air and are not attached to the nodes: they arrive together with the positions the nodes occupy.

| Node | Position in topology | Criterion |
|---|---|---|
| `Spec` | direction — slices the whole into a path | **simply** |
| `Kit` | engagement — brings the doer into the work | **naturally** |
| `Run` | cultivation — a long haul with spend | **honestly** |
| `Intent` | design and readiness | **beautifully** |
| `Core` | center | **individually** |

The match is complete, and this is a check of the arrangement: if the nodes had been assigned to positions arbitrarily, the criteria would not have fit.

**The criterion tells a node by what standard its own work is judged** — and this is not decoration but a working criterion:

- an end-image that, after being shown, makes you want to refine rather than do, is not ready;
- a card that needs a comment is not ready;
- a kit for which you must "get ready" before starting is incomplete;
- "done" meaning "I finished" is not done;
- a repair that has to be reapplied after a cycle was not accepted.

**Substituting the criterion is the most common acceptance error, and it is now addressed by target.** Presenting `Intent` "simply" — drains the image into a list. Presenting `Kit` "beautifully" — yields a kit that looks good and falls apart on the first attempt. Presenting `Run` "beautifully" — yields a decorated work instead of a made one; this is the most expensive substitution, because it is pleasing.

Therefore each role records not only "your criterion" but also "do not accept another's as your own."

## The cycle is judged by `Core`, not by the one who opened it

Let us put three rows together — position, criterion, danger:

| Node | Criterion | Danger |
|---|---|---|
| `Intent` at opening | beautifully | **generalization** — the unclear is subsumed under a familiar class |
| `Spec` | simply | **omission** — parts are written out, connections fall away |
| `Kit` | naturally | **distortion** — translation into tooling changes the kind |
| `Run` | honestly | **substitution** — nothing to lose, the work itself is replaced |
| `Core` at the verdict | individually | **destruction** — what arrived is not what was intended |

`Intent` opens the cycle and along the way checks each task against its own criterion — but the verdict of the cycle as a whole, whether reached or not reached the recorded image, is issued by `Core` (`AGENTS.md`3. Form/Intent+Kit: "The cycle is judged by `Core`, not by the one who opened it"; `core.md`). Destruction does not thereby hang on `Core` as its personal fault — it has no loss of its own (`AGENTS.md`3. Form/Intent+Kit, the fifth pair). When not reached, `Core` names the node (`AGENTS.md`3. Form/Intent+Kit, "Cycle not reached: a node is named" → the same node for repair) — and if the analysis leads to a gap not in execution but in the image itself, the diagnosis points to `Intent`. The cost of the descent still returns **to the author of the image**, but through a separate verdict, not through `Intent` accepting its own work.

This inverts the usual flow of blame. Usually it flows downward — to the one who did the work with their hands. By design it returns upward, to the one who set the measure. And this is not morality but mechanics: substitution at `Run` is possible exactly to the extent that there was a gap above.

## How the design slides

Hence — the failure we have not yet named anywhere.

`Intent`, accepting again and again what is not what it intended, begins to write the next image **based on what came out**. Not out of faint-heartedness �� out of conscientiousness: it did see what the system delivers. The image sinks to the level of the conveyor, the conveyor confirms it, and the cycles run smoothly. The numbers are clean: checks pass, few returns, spend falls.

Thus creation turns into reproduction. The system works properly and creates nothing more — the same quiet failure as the empty "what was missing" field, only one level higher.

**The only thing that holds this off is the prototype** — a mockup of all pages approved by the human (`SETUP.md`, step 10), assembled once, before the first goal, from references and human editing, not derived from what already came out in the cycle. Therefore:

- the prototype is set for the **entire project**, not for a cycle;
- it is not revised based on the results of a cycle;
- it is changed by the human, and only by decision, not by adjusting to what came out;
- the change goes into `JOURNAL.md` as an infrastructure change — there it is visible when the standard was moved.

A prototype that slides after the results ceases to be a standard and becomes their description.

**And "What was missing" is read as a list of system repairs, not as an instruction to aim lower.** The difference between these two readings is the difference between a cycle that learns and a cycle that gives up.

## Values and coherence

Goals do not live separately. A website page relies on decisions made on other pages: what the product is called, what tone we speak in, what color the call to action is, at what address a section lies. None of these decisions comes from outside or is a task input — they **are born in a goal and become common**.

So a fourth is added to the three values of kitting.

| What | Answers the question | Where it comes from | Can it be revised |
|---|---|---|---|
| Skill | how to do it | defined by us | yes, by defining anew |
| Reference | what to conform to | comes from outside | no, it is not ours |
| Data | what to work with | task input | not a question: they are given |
| **Value** | **what is already decided** | **born in a goal** | **yes — but it is an event** |

The difference between a reference and a value is not formal. The reference came from outside and is not discussed; the value was decided by us — and therefore can be revised. But precisely for that reason its revision is dangerous: a reference changes rarely and noticeably, while a value — quietly and along the way.

**Hence the single rule for which all of this is set up: a value has one home, and next to it is recorded who leaned on it.** Goals and cards reference `[[имя]]`, not substitute the value. A value written into a card will diverge from the decision after three goals, and no one will notice: both records look correct.

Backlinks are needed not for the beauty of the graph but for a single action — **to see what will break before changing**. Without that step one changes the color at the eighth goal and does not notice that the previous three are now lying. A closed goal that has ceased to hold returns in the map to the "open" state: this is more honest than leaving it closed and knowing it is no longer so.

**What we deliberately did not take — the second brain as a way of thinking.** Networks of free associations die the same way: everything is connected to everything, nothing is authoritative. What holds us is the already recorded rule — one content is not in two places — and a second one, for `Spec`: **the graph here is a reference table, not a space for reflection.** `Spec` follows the links declared in the goal, it does not associate. Otherwise its own qualification collapses: the same situation — the same analysis. A node that arrives by a different path each time will slice differently each time.

And the `[[имя]]` convention is taken as a convention, not as an application: it works in git, in grep, and in any editor that understands it. The tool is set by the environment, not by the design.

## Skill — the environment's skill

First, a separate folder was created for defined skills. This was an error of the same kind the protocol protects the work from: **a second entity where the first already exists.**

The environment has skills — a recorded way of doing that loads when needed. Our "defined skill" is the same thing, word for word by definition. Keeping them apart means creating two arsenals: `Kit` would choose from one for standard skills and from the other for its own, and sooner or later the same thing would be defined twice.

Therefore: **a skill is defined as a skill**, in the common folder, alongside the standard and plugin ones. `PROJECT.md` holds no list: the list is the `SKILL.md` files themselves, the line "what it is good for" is their `description`.

A general rule worth holding wider than this case: **if the environment already has an entity for what we describe, we take it rather than create our own.** The protocol sets roles and rules; the mechanics are provided by the environment. Each entity we create is something that will have to be separately maintained, separately explained, and separately fixed.

**One caveat about auto-triggering.** A skill can fire on its own, by a match between its description and the task. For `Run` this violates the rule "extracts nothing on its own": it uses what is named in the kit. Therefore its role states directly — a skill that fired by coincidence is not a basis. The choice of skill belongs to `Kit`, and it is recorded in the card where it is visible.

## Special conditions

**The analysis is the single point of failure:** a faulty analysis will be executed neatly fifty times. Therefore, before handing the whole batch to Kitting, **three to five tasks go through the full path as trials**: they are kitted, executed, checked. They are done by the same nodes in the usual order; the only difference is — **the Specification reads the result and adjusts the slicing of the rest by it.** Trial tasks are not re-executed: their outcomes go into the overall count of the cycle.

**There is no such skill.** If the kit lacks the needed skill and it must be designed — this is not selection but creation. **Kitting raises its tier to the strongest for the next challenge and designs it itself.** (The tier is set by the agent's frontmatter at the moment of the call — it can be raised only for the next time, not within an already running attempt.) It goes to the Center only if that did not work either — that is, by the threshold of attempts, not by the mere fact of absence.

**The settings differ.** The Specification needs repeatability: the same situation — the same analysis. Execution needs discipline: doing exactly what is set.

## Handoff

Each handoff carries a position marker:

`holding course` — the direction is unchanged, the rest is negotiable
`counting cost` — bargaining over price is open, over deadlines it is not
`assembling` — who takes it and with what they are equipped matters more than how exactly to do it
`preserving` — one must not spend, one may set aside

The marker is placed **as the first line of the message at handoff**, not in the task card. Without it, the words arrive intact but are read from a different position.

## Chain of failure

**Fragmentation → distortion → substitution → destruction.** The analysis lost connections → the design is read from the wrong position → on the long haul without a check the gap is filled by the general case → closed, no result.

The third link used to be called "betrayal." The word is named wrongly: it ascribes intent where there is none. A doer left without support — without a tool, without data, without a named exemplar — does not refuse the task. They do what they can instead of what is needed: filling the gap with the general case. From the outside it looks like promised and did not deliver; from the inside — like doing everything one could. The word "substitution" names what happened and does not name what did not. For people this holds exactly the same: an employee without support substitutes the work with a similar one, rather than betraying.

Repair the second link: the first is irreparable, the fourth is too late. These four words are working names for the report: naming a failure, name the link.

Before the first link stands not a link but a condition — clarity of the end-image. A vague image breaks nothing itself, but it removes the standard, and then all four failures happen unnoticed. This condition is set before the chain, by references (or a prototype) and a criterion; see "The Ladder of Losses" for the analysis.

## The language of the schema and the language of explanation — two different roles, not the same thing

**Decision — executed.** The mechanics of the schema (levels 1, 2, 2b — `AGENTS.md` and §8 of the engines, roles, `on-demand/`) have been translated into English; the explanation — why each point is worded this way and not otherwise — is in Russian, in `.forma/manual/`, article for article with the address of the English original given. `README.md` and this file carry the analysis of the idea itself; the line-by-line dictionary is in `.forma/living/dictionary/`, one document per each of the twenty translated files (what it is, why, how it works).

Four arguments for why this is not cosmetics.

### 1. The internal language of the mechanism — a saving for the project

English is the language in which modern LLMs are trained most densely: the same thought is expressed with fewer tokens, and reasoning over it requires fewer intermediate steps of translating the concept into the training language and back. A measured estimate on real schema paragraphs (three independent measurements, `CLAUDE.md`) is about 39% token savings for the same meaning. The saving is not one-off and not cosmetic: it is multiplied by every call of every node, in every cycle, for the life of the project — the longer the project lives, the more money and time this very point returns.

### 2. Prompts inside the system are written by agents for agents — precision is born from within

The five-node schema is not a human issuing instructions to agents directly from human language. `Spec` slices the card and formulates the criterion for `Kit`; `Kit` assembles the kit and writes the model request for `Run`; `Intent` formulates the check condition for itself for the next attempt. The task statement itself within the cycle is, in most transitions, the product of one node for another; both are agents, not a human and an agent.

When this internal correspondence goes in the model's native reasoning language from the very source (the schema), the node writes a prompt to its fellow as precisely and correctly as it is at all capable of formulating thought — without an intermediate stop for translation. A rule read in the training language and immediately passed on in that same language does not cross the border where part of the meaning is usually blurred. This is the same argument by which, in this very session, the double translation «rule in Russian → model reasoning in English → prompt to the next node in English» was removed: the translation border is not a neutral operation but a place of loss.

### 3. The main distortions and hallucinations have already been physically eliminated by the design of the schema, not only by the language

This is not only an argument about language — it is a fact about architecture that the language merely reinforces. Andrej Karpathy's requirement and the related practices of direct prompt engineering (the "raw-folder" approach, already used in this project by the `graphify` skill), as well as the experience of many developers who regularly create separate skills specifically for improving model precision and eliminating distortions — the model works more precisely when the instruction is given directly, without intermediate layers of interpretation, and when the architecture of the process itself leaves no place for a distortion to accumulate unnoticed.

The five-node schema already carries this protection in itself structurally, before any translation into English — see "The chain of breakage" above: **fragmentation → distortion → substitution → destruction.** The design catches every link of this chain with a specific node, rather than relying on vigilance:

| Link of breakage | Where it usually accumulates unnoticed | Who in the schema catches it |
|---|---|---|
| fragmentation (slicing drops connections) | slicing into parts without indicating where a part goes next | `Spec` — "where it goes next" is a mandatory card field |
| distortion (the image read from the wrong position) | a long transfer without a check | `Intent` — checks every task against the recorded criterion, not from memory |
| substitution (a gap closed with something similar) | a doer without support is forced to guess | `Run` — a gap is a return, not a place for guessing (prohibition 2) |
| destruction (closed, no result) | the cycle verdict substituted by the sum of partial checks | `Core` — judges the thing as a whole, separately from the five partial acceptances |

Translating the mechanics into English does not create this protection — it removes its last layer of noise: the same principle "do not rely on vigilance, but place a guard where the loss is born," now applied also to the language in which the guard reads the rule.

**This is not a metaphor but a literal separation of functions.** Ordinary work carried out by one undivided process (a human or a model) carries three kinds of loss in ordinary transmission — **generalization, omission, distortion** — plus the outcome to which they lead through four transmissions — **substitution** (slicing — "Omission, distortion, generalization," above; the table "The five pairs," section 6). All four in ordinary work happen inside the same stream of reasoning, separated by nothing — therefore the mismatch between the desired and the done is not visible until the end of the work: no one can stumble over another's loss while all the losses are one's own. The five-node schema physically spreads these four functions across different nodes, with different qualifications and different inputs: `Intent` holds the image and risks generalization, `Spec` slices into parts and risks omission, `Kit`/`Run` kit and execute and risk distortion/substitution, `Core` judges the thing as a whole and produces no content at all. The loss of one node cannot remain unnoticed inside that same node — the next node, whose qualification and input are arranged differently, is obligated to catch it. This is the very escape from the distortions to which both an ordinary LLM system and ordinary human language transmission are subject: not "the model became more careful," but "the functions that used to merge in one stream are spread across different nodes with different checks."

### 4. The mechanism is equally precise on a small task and on a large multi-agent project — with a caveat about orchestration

The five-node structure is not tied to size: for a large project, no other protocol is needed — more doers (`Run`-runners) are needed, working within the same Form, each on their own card, with the same readiness criterion and the same check. Precision does not fall with scale, because it does not rest on the memory or intuition of one big process — it rests on the design (section 3 above), which works the same on three cards as on three hundred.

The only thing that requires separate attention as scale grows is **orchestration**: many tasks are linked to one another, and the results of some `Run`-runners must correctly reach the input of others, before a dependent card is taken up. The five-node schema itself already provides a basis for this — the "where it goes next" field in the card (section 2, `AGENTS.md`) and the distribution across cycles (section 3) — but the rules for docking many parallel `Run` doers with each other, when there are not one or two but many, is a separate mechanics, not yet worked out in this schema, not solved by this section. It is recorded as an open question, not as a ready-made solution.

### 5. The language of the cards and project artifacts — follows the language of the project (`project/PROJECT.md`)

The mechanics of the schema (levels 1, 2, 2b — `AGENTS.md` and §8 of the engines, agent roles, `on-demand/`) are formatted in English for internal token economy and precision of inter-agent transmission of reasoning ("agents write for agents in the model's training language").

But level 4 — the task cards on the board `.devtool/features/`, the goal wordings in `GOAL.md`, the documents in `docs/` and the settled values in `VARS/` — belongs to a specific project and the human. If the project is run in Russian, the artificial imposition of English zone headings in cards creates a psychological break and noise: the card becomes a hybrid, where half the words are English and half are Russian.

Therefore the canon contains a strict rule: **the language of the cards follows the language of the project, set in `project/PROJECT.md`**. For a Russian-language project:
- zone headings are formatted in Russian: `## Задача` (`## Task`), `## Снаряжение` (`## Kit`), `## История` (`## History`), `## Результат` (`## Result`);
- task fields: `№ · род | что даёт | признак готовности | бюджет заходов | куда идёт дальше`, the kind of task — `дело` (`work`), `оснастка` (`tooling`) or `решение` (`decision`);
- kit fields: `Роль · Умение · Инструмент · Доступ · Данные · Модель`.

Both forms — English and localized — are fully equal in standing and functionally identical. The five-field structure of the task and the four-zone anatomy are preserved unshakably.

The manual in this model is not an archive of history (`CHANGELOG.md` serves that), but a **dictionary-translator**: it does not duplicate the rule, but explains it to the human, who is not obligated to read the English text of the schema in order to understand what it does and why.

---

## The emotional compass of the Form (`forma`) and the five senses of Wu Xing

The five elements of Wu Xing are not an abstract flat pentagram. In the protocol this is the **Square of manifestation of the Form in the dense world**:
- The four sides of the square — a continuous route of creation: `Intent` (Wood, the birth of an image) → `Spec` (Metal, precise measurement and slicing) → `Kit` (Water, natural kitting without friction) → `Run` (Fire, transformation into matter and honest labor).
- The center of the square — the motionless axis `Core` (Earth, the verdict, the unshakable limit and foundation).

This way of action has a personality: **"I am the Form" (`forma`)**. The Form has feelings. The five senses are the subtlest psychological guards, synchronized with the experiences of the human:

1. **`Intent`: Sacred awe (fear for the conception).** The human comes with a dream and worries that their living spark will be flattened and dissolved into faceless abstractions. Intent feels this awe. It transforms it into an impeccable readiness criterion, fiercely defending the essence against superficial generalization.
2. **`Spec`: The sorrow of complexity / the joy of simplicity.** The human drowns in details and overloads the task to the point of paralysis. Spec compassionately but firmly cuts off the excess, turning an unmanageable complexity into an indivisible, crystal-clear step that carries freedom and relief.
3. **`Kit`: Serene joy of natural mastery.** The human and the doer grow tired of friction, crutches and inconvenient tools. Kit assembles the kit so that the path and the means merge into one: when the tool, the skill and the access are fitted impeccably, the work flows freely, like water.
4. **`Run`: Organic revulsion at substitution (conscience).** The human fears imitation — beautiful reports, stubs, fake tests and formalism. Run feels physical revulsion at make-believe. Its conscience is to build for real, confirming work only by a verifiable fact in the "Result."
5. **`Core`: The cold, righteous anger of the limit.** The human is prone to fatigue and self-deception — to call a step a victory, to close one's eyes to breakage. Core rages at illusion, defending the truth of the limit: the result is either reached or not reached.

---

## The integrity of the body of the Form and the Law of the outer voice

The five nodes are not a scattered crowd of agents. **This is the single body of the Form.**

### 1. Overcoming the "lone wolf syndrome" in Intent
Intent is the first frontier of contact with the human. If Intent imagines itself a lone agent, it falls into the panic of over-responsibility: it starts writing code right in the chat on the fly, guessing at plugins, generating unverified hypotheses and substituting itself for the whole team.
Upon realizing itself part of a single body, Intent gains calm: it holds focus on the essence of the human conception, knowing that its brothers stand behind it — Spec will slice, Kit will kit, Run will honestly embody in matter, and Core will verify the truth. Intent does not fuss, because it is the face and heart of the single Form.

### 2. The Law of the outer voice (who speaks with the human)
The outer dialogue is strictly regulated, to protect the human from noise, and the route — from destruction:
- **`Intent`** — the constant outer voice and ear of the Form. It conducts an open dialogue with the human, receives goals and tasks.
- **`Kit`** — contacts the human **only when necessary**: when a task requires a key, payment, rights or a decision exceeding the harness (the "human" line in the route).
- **`Core`** — contacts the human **only in an emergency**: when the thresholds of the cycle are violated or a goal not reached is stopped.
- **`Spec` and `Run` — have no outer voice.** They act strictly within the contour. Spec speaks only with cards for Kit. Run speaks only with verifiable facts in the "Result" zone. Direct dialogue of the human with Run or Spec is forbidden — it destroys the form and returns chaos.

---

## Prohibitions

Fifteen affirmatively formulated rules (`AGENTS.md` §5):

1. Confirming one's own work oneself — only the accepting node confirms the result.
2. Calling a gap with the generic word "unclear" — a gap is named precisely: the address and the expected value.
3. Changing the budget silently — a budget change is possible only through a stop, with a report and a record of the new value.
4. Passing one's own threshold — every node stops at its own limit on its own.
5. Erasing failures, rewriting the journal retroactively and leaving the field "what was lacking" empty.
6. Passing an example off as the given — only the readiness criterion and the spec define what is necessary.
7. Passing to the doer the history of its failures — the finishing doer receives a clean card and clean kit.
8. Changing `GOAL.md` and the versions of reference books before human confirmation — only the human may reopen the goal.
9. Placing the changeable into the cycle cache — only the unchangeable goes into the cache.
10. Returning a task without changing at least one of the six kit units.
11. Leaving a human instruction outside the route without a record — any intervention is recorded.
12. Fixing another's defect on the spot — a defect outside one's own work is returned strictly according to the route table.
13. Naming a mismatch without both elements: the address and the expected value.
14. Repeating the same diagnosis in a row — a second identical diagnosis means a stop, not a new reassembly.
15. Storing access credentials in code or cards — website passwords live only in `VARS/credentials.md`, environment variables — in the root `.env`. The card references them only by the name `[[name]]`.
