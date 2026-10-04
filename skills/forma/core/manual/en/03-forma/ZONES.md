# Five zones of the «Form» protocol — constructor

Fixed — the very principle of the five nodes and the route rules (`AGENTS.md`). Not fixed — the specific tool under each node: board, dashboard, interview channel, project profile — these are swappable details of the constructor, not the only possible implementation. What is described below as "our choice" is a reference implementation, made as well as possible, but not the only lawful one. The human is free to assemble their own dashboard, their own graph, their own project profile, their own interview channel — the principle of the five nodes does not change because of this.

The numbering of the zones is not the order of the execution route (`Intent → Spec → Kit → Run → Core`), but the order of installation dependency: from mechanics — to communication — to the substrate — to analytics on top of the substrate — to execution.

---

## 1 · Kit — the core (mechanics)

**What is included:** the law of the protocol as a single file (`AGENTS.md`) and the engine harnesses with their §8 (`.claude/rules/claude-8.md`/`.agents/rules/gemini-8.md`) + the role functionality of the five nodes (`.claude/agents/`, `.agents/plugins/forma/agents/`) — the mechanics itself: procedures, processes, sequences, production interdependencies (who depends on what, how work is handed over).

**Mandatory, part of the core.** Without this there is nothing at all — it is what all five nodes are made of. This schema is physically governed by `Intent` (`intent-housekeeping.md`) — but by nature, by the essence of the kit, this is `Kit` territory: the schema itself is a description of how to kit.

**Installed:** the `forma` core (`claude plugin install forma@forma`).

## 2 · Intent — communication with the human (interview)

**What is included:** intent, conversation, interview — obtaining the most precise information from the human. This is the key task of the protocol: any inaccuracy at this step multiplies throughout the entire cycle.

**By default:** the classic channel — the harness, `AskUserQuestion`/chat, the capability for conducting an interview with the human already built into the environment (Claude Code, Codex, etc.).

**Enhancement on top — part of the core, not a companion.** Interview visualization (`forma-grill-with-ui`, question cards, discussion of each, a final document along the five axes of Form) is installed by the same `forma` call, together with the basic terminal variant; `Intent` chooses between them itself — the browser by default when available.

## 3 · Core — the kanban board

**What is included:** the physical board (`.devtool/features/`) — the single place where everything flows: card status, history, result, spend statistics, accumulated experience and knowledge.

**Mandatory, but separate from the core.** Without the board, it is not just the "Core zone" in the narrow sense that fails — the substrate on which all five nodes stand at once collapses: the dashboard and graph have no data to draw from, `Intent` cannot check the criterion, `Kit` cannot kit based on facts. That is exactly why the final verdict of the cycle is issued here as well — Core judges by the same substrate from which the others read.

**Not carried by the `forma` plugin.** Installed separately — the VS Code extension [Kanban Markdown](https://marketplace.visualstudio.com/items?itemName=LachyFS.kanban-markdown) (`code --install-extension LachyFS.kanban-markdown`), today our only choice of technology for this mandatory function. The principle itself (a centralized point for collecting statuses/history) is fixed; the specific technology is a swappable detail, like everything else in this list except item 1.

## 4 · Spec — the graph and dashboard

**What is included:** analytics on top of the board. `Spec`, slicing goals into cards, generates the material that the dashboard shows in real time (spend by node, tooling, status), and the knowledge graph gradually condenses into reusable knowledge (`.devtool/features/done/`, the "Experience" graph).

**Dashboard + graph in one interface tab — part of the core, not a companion.** Installed by the same `forma` call. The graph rebuild trigger and the doer (external model/subagent/manually) are configured together with the human at installation, not decided for them.

**Constructor:** the human can assemble their own dashboard and their own graph in their own way — our variant is a reference one, not the only one.

## 5 · Run — project profiles

**What is included:** kitting the doer with specific tools of the work — what `Run` actually uses when doing work in a specific project (a website, an application, anything else).

**Two states, both already exist:**
- **Empty profile** — the `project/` skeleton (six files, six directories), filled in together with the human through an interview (`project/config/SETUP.md`), part of the core by default.
- **Pre-prepared profile** — for a specific project type, directories, documentation, and recommended skills are already ready. Example: `forma-wordpress-novamira` (Novamira MCP, Magnific, skills `novamira-wp-deploy`/`novamira-wp-elementor`/`excalidraw-diagrams`).

**Constructor:** every human can create their own profiles for their own task type — `forma-wordpress-novamira` is not the only possible profile, but one of many that can be created.

---

## Summary table

| № | Node | Zone | Status | Artifact |
|---|---|---|---|---|
| 1 | `Kit` | mechanics (schema, roles) | mandatory, core | `forma` plugin |
| 2 | `Intent` | communication with the human (interview) | mandatory, core | `forma` plugin (terminal + browser) |
| 3 | `Core` | kanban board | mandatory, separate from the core | VS Code Kanban Markdown extension |
| 4 | `Spec` | graph and dashboard | mandatory, core | `forma` plugin |
| 5 | `Run` | project profile | base built in (empty skeleton); alternative — by choice | `forma-wordpress-novamira` (and others, by project type) |

**Registration rule:** a new zone or separable template — a new row in this table and its own section above, in the same attempt in which it is created. Details — `.forma/manual/en/03-forma/SKILLS.md`.
