# Skills and plugins

A registry of everything related to the «Форма» protocol — one section per marketplace plugin of `IamForma/forma` (`.forma/protocol/.claude-plugin/marketplace.json`), plus a kanban board that is not a plugin. The core (`forma`) brings everything the protocol cannot work without, in a single call. Two separable pieces remain: the project template (a plugin, chosen by the human) and the kanban board (an external editor extension, a mandatory condition).

**Rule:** a new plugin in the marketplace means a new section here, in the same attempt the plugin is registered in. The one who created the plugin adds it.

---

## `forma` (core, mandatory)

The protocol itself — the five nodes (Intent/Spec/Kit/Run/Core), route laws, cards, thresholds — **and everything it cannot work without: both interview variants and the dashboard with the knowledge graph.** Installed once per project as `AGENTS.md` (the law, §1–7) + `.claude/rules/claude-8.md` (§8 of Claude Code) + `.claude/agents/` + `.claude/hooks/` (+ in parallel `.agents/rules/gemini-8.md` + `.agents/plugins/forma/` for Google Antigravity):

- **interview** — the terminal skill `grilling` and the browser page `forma-grill-with-ui` (a fork of [`jasonku09/grill-with-ui`](https://github.com/jasonku09/grill-with-ui), MIT, Russian interface, reworked for our formats); `Intent` chooses between them itself — browser by default when available, otherwise the terminal (`intent-goal-opening.md`, "Epic");
- **dashboard** — a local interface for node spend/tooling (`node .forma/dashboard/serve.js` → `localhost:5050`, live SSE update when a card is edited) and the knowledge graph (`graphify`) as one tab of the same interface, not a separate window. It carries a forked copy of the third-party `graphify` skill (version `0.6.0` as of the fork) — upstream updates are pulled in manually, only after checking completeness and compatibility, not automatically. Graph rebuild is configured in `.forma/dashboard/graphify.config.json`: `trigger.mode` (`off` by default, or `history-accumulation` based on accumulated history) and `executor.channel` (`internal` by default — via a live session, or `external` — via `.claude/scripts/external-model-bridge.cjs`, requires a key in `.env` and money).

The core carries nothing domain-specific — common laws and common tooling, the same for any project on this schema.

Installation: `claude plugin install forma@forma` → the `forma` skill (`/forma`, or simply «поставь Форму» / «обнови Форму» in words).

Details — `.forma/protocol/skills/forma/SKILL.md`.

---

## `forma-wordpress-novamira`

A separable project template — WordPress development with the help of Novamira MCP (+ Elementor) with Aura/Magnific bundled. Two ready-made skills (`novamira-wp-deploy`, `novamira-wp-elementor`) + an installer for an empty `project/SITE.md` stub (an architectural snapshot of a specific site — its own for each project, not portable in general form; product data lives in `project/`, never in `.claude/skills/`). Separated because the template predetermines the working experience — a route the project is only learning to form and pass along; the core does not depend on this decision.

Installation: `claude plugin install forma-wordpress-novamira@forma`.

Details — `.forma/protocol/templates/forma-wordpress-novamira/README.md`.

---

## Kanban board (not a plugin of this marketplace)

A mandatory external condition, not a recommendation: without the VS Code Kanban Markdown extension (`code --install-extension LachyFS.kanban-markdown`), the `.devtool/features/` cards remain just a folder of `.md` files — the dashboard, the graph, and the criterion check have no data source. Installed manually as an editor extension (VS Code or Antigravity), because otherwise there is no way — no Claude Code plugin can install an extension for a third-party editor. Details — `.forma/manual/en/03-forma/ZONES.md`, zone 3 "Core — kanban .forma/board".
