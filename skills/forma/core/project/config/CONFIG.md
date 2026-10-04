# CONFIG — project structure configuration

About the layout of this particular project — which directories, which files, what each is responsible for; it grows with the goals, like `PROJECT.md`. Not to be confused with `manual/` in the project root — that one is universal, not about this project, and does not change.

Nine sections, two per "working" node (the role + the documentation it forms) and one central for `Core` — the table below. `Kit`'s documentation (section 6) is wider than a tooling log: it carries the whole project structure, file by file and directory by directory, with the essence of each.

---

## Nine sections (by node)

The organizing principle is by node: a pair of sections for each of the four "working" nodes (the role + the documentation the node forms), and one central `Core` section, outside the pairs. 4×2 + 1 = 9.

| № | Node | Section | Essence | Where |
|---|---|---|---|---|
| 1 | `Intent` | Interview | collecting the brief — what the human said before the first goal, not rewritten along the way | `project/brief/interview.md`, `history.md`, `reference.md` |
| 2 | `Intent` | Acceptance and accompaniment | checking every task and cycle against the criterion, receiving `Run`'s reports, running the whole project in conversation with the human — `Intent` as the human's single point of entry | distributed on purpose, not by oversight: `GOAL.md` (history of checks), `ROADMAP.md` (what the goal delivered), `JOURNAL.md` (cycle facts) — three files with different kinds of record; merging them into one would duplicate what is already written in its own place |
| 3 | `Spec` | Slicing | dividing a cycle into linked task cards | `.devtool/features/` (the card is the top), `spec.md` |
| 4 | `Spec` | Statistics and value | what was sliced and what was obtained as a result — cost/spend, what the product consists of, for clarity | `project/ops/VALUE.md` — started by `Spec`, called by `Intent` when a goal closes (`intent-cycle-closing.md`, "After the verdict"; `spec-statistics.md`) |
| 5 | `Kit` | Work and role | a task's kit: access, data, skill, tool, model | `kit.md` |
| 6 | `Kit` | Documentation (tooling) | the whole project structure (what each file/directory is, its essence) + a log: which tool/access/skill appeared and which gap it closed | this file → section "6. Kit — Documentation (tooling)" below |
| 7 | `Run` | Work and role | executing exactly what was assigned with the skills issued, no improvisation | `run.md` |
| 8 | `Run` | Documentation (per project) | the final description of what was done, per cards of kind "work", for the human | `project/docs/` (per goal, `docs/goal-NN-<name>/`) |
| 9 | `Core` | Central | the verdict on the cycle as a whole (not the sum of five checks), thresholds, node diagnosis, efficiency trend | `core.md`, `GOAL.md` → "Series result", `JOURNAL.md` |

**Items 2 and 4 are closed.** `Intent`'s acceptance stays distributed — not a gap but a deliberate choice not to duplicate what is already written in `GOAL.md`/`ROADMAP.md`/`JOURNAL.md`. `Spec` got its own file for statistics and value — `project/ops/VALUE.md`, filled in when each goal closes.

---

## 6. Kit — Documentation (tooling)

This section (№6 in "Nine sections" above) carries not only the tooling log but the whole project structure — `Kit` knows the structure precisely in order to kit: just as `Kit` kits `Run` for a task (six kit units — access, data, skill, tool, model, card), it kits any node, knowing each file's and directory's function. The structure map and the tooling log are one knowledge, one section, not two.

### Project structure

#### Scheme (common to any project on this protocol)

| Section | Essence |
|---|---|
| `AGENTS.md` | rules of conduct common to all nodes: the cycle route, card format, thresholds, position markers, five pairs, prohibitions, the board |
| `README.md` | the human's entry to the scheme — why it is built this way |
| `manual/en/03-forma/SCHEME.md` | the whole scheme layout: the nodes, environment requirements, the cycle cache, collapsing, numbers, the file tree |
| `manual/en/03-forma/PROTOCOL.md` | the rationale of the scheme's rules — why this way and not another |
| `living/CHANGELOG.md` | the protocol's version log: what changed and what it fixes |
| `manual/en/03-forma/five-nodes.md` | the blueprint of file ownership by role — which node writes which file |
| `manual/diagrams/` | visual diagrams of the route and the structure |
| `intent.md` (the engine's role directory, §8) | the `Intent` role: result image, interview, check, record |
| `spec.md` | the `Spec` role: slicing a cycle into cards |
| `kit.md` | the `Kit` role: a task's kit, the arsenal, infrastructure, the summary in `CONFIG.md` |
| `run.md` | the `Run` role: execution by the kit issued |
| `core.md` | the `Core` role: cycle verdict, thresholds, diagnosis, trend |
| `<the engine's skills directory, §8 of its file>/*/SKILL.md` | formalized skills — both shared (`grilling`, `skill-creator` and the like) and subject skills of this project |
| engine hooks (§8) | checks at session start/action (`guard-delete.sh` — protection of scheme paths, `check-ready.sh`) |
| engine settings and `.mcp.json` (§8) | tool permissions, connected MCP servers |
| engine adapter directories | each engine has its own, listed in §8 of its file; the core does not require them |

#### Project (specific to this project — grows with the goals)

| Section | Essence |
|---|---|
| `project/config/PROJECT.md` | what we work with and at what level: thresholds, node tooling, the project's epic names — filled in for this work |
| `project/ops/VALUE.md` | statistics and value across closed goals — attempts, tokens, what the project received |
| `project/ops/ROADMAP.md` | what we build and in what order — the goal map, the state of each |
| `project/config/CONFIG.md` | this file |
| `project/ops/JOURNAL.md` | records of closed cycles |
| `project/config/SETUP.md` | the order of preparing the project before the first goal, step by step |
| `project/VARS/` | the project's settled values — by entity files |
| `project/brief/interview.md` | the interview script with the human: five positions (beauty/simplicity/individuality/honesty-mission/naturalness), not rewritten along the way |
| `project/brief/history.md` | what the human said — recorded before the first goal |
| `project/brief/reference.md` | references collected at the interview |
| `project/docs/` | the description of what was done, for the human, per goal (`docs/goal-NN-<name>/`) — `Run`'s documentation (section 8 above) |
| `project/goals/goal-NN-<name>/GOAL.md` | the goal segment: result image, criterion, cycles, verdicts |
| `project/mockups/` | mockups being refined to a state fit for building — own content per project, the method (draft vs fixed version) — in `mockups/README.md` |
| `project/reference/` | the project's reference material — design system, entity specifications, prompts and the like, which cards refer to; the contents depend entirely on the project, the scheme does not dictate them |
| *the rest* | specific to each project, not in the list above; added along the way, with its own line here |

#### The board

| Section | Essence |
|---|---|
| `.devtool/features/` | kanban: the card is a file, the status column is the actual location/`status` field |
| `.devtool/features/done/` | closed cards |

### Technical contracts of the environment

Environment limits that `Kit` must build into the kit in advance rather than wait for `Run` to diagnose the same snag again. `PROJECT.md`, the "Node tooling" table, holds only the tool name and one invariant line with a link to a specific anchor here — the contract itself (date, reason, source card) lives only here, in one place.

`Kit` writes it as soon as the fact is found — unlike the "Tooling log" below, which is written as a summary when a goal closes (`kit.md`, "Reconnaissance"/"Return"). The record format — a heading with an anchor (`#contract-name`), the essence of the contract, the date and the source card.

#### Contract `omitClaudeMd` {#omit-claude-md}

Fact (checked by reading the official Claude Code documentation, `code.claude.com/docs/en/sub-agents`, section "Supported frontmatter fields"): a subagent by default receives the whole `CLAUDE.md` (user + project + local) unless this is explicitly turned off by the frontmatter field `omitClaudeMd: true`. Rule: a task of the class "text in / text out, no routing decisions" is kitted with the `extractor` subagent (`extractor.md` in Claude's role directory, `omitClaudeMd: true`), not `general-purpose` — the latter silently drags the whole protocol into context, which such a task does not need.

There are no records of findings specific to this project yet — the next ones appear as soon as the environment first springs a surprise.

---

### Tooling log

A reference on the system's own tooling: which tool, access or skill appeared and which gap it closed. Not a chronology — the chronology is in each card's history; here only a conclusion fit for the future.

**Written by `Kit`, as housekeeping, when each goal closes** (`kit.md`, "Config"; called by `Intent`, `intent-cycle-closing.md`, "After the verdict"). The source is the cards of epic "3. Form/Intent+Kit" about its own (resource/tool/skill), closed since the last summary.

**Read by `Kit` when kitting**, before external sources of the ready-made (skill `skill-authoring`, "Sources of the ready-made"): the gap may already have been closed in a past goal.

#### Record template

```
### <tool/access/skill> — goal N, cycle M

**Closed the gap:** <what did not work or was missing>
**Source card:** `.devtool/features/done/<file>.md`
```

---

No records yet — the first appears when the first goal closes.
