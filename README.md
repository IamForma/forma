# Forma

**English** · [Русский](README.ru.md)

A five-node project protocol for AI agents: `Intent` (the idea), `Spec` (slicing), `Kit` (kitting), `Run` (execution), `Core` (the cycle verdict). Runs in Claude Code; Codex and Gemini adapters are in progress.

## Installation

**Requirements:** Node 18+, Git, Claude Code. For the board — VS Code (or Antigravity) with the Kanban Markdown extension.

### Way 1 — installer (recommended)

From the target project's folder:

```
npx github:IamForma/forma init
```

It installs the core (`AGENTS.md`, roles, hooks, board, dashboard, `manual/`) and asks three questions:

1. **Engines** — `claude` (ready); `codex`, `gemini` — not ready yet.
2. **Project template** — none (the route is worked out in the interview) or a ready one, e.g. `forma-wordpress-novamira`.
3. **Kanban board** — find the editors and install Kanban Markdown, or skip.

Without questions: `npx github:IamForma/forma init --engines claude --template none --board auto`.

Running it again is an **update**: the scheme is overwritten; `project/`, the board and `living/` are left untouched. The package is not on the npm registry (the name `forma` is taken there) — use `github:` only.

**If the first `npx` run prints nothing and installs nothing** (seen on Windows): the npx cache was likely left half-downloaded. Run the command again; if it still does nothing, delete the cache folder (`%LOCALAPPDATA%\npm-cache\_npx` on Windows, `~/.npm/_npx` elsewhere) and retry.

### Way 2 — git clone

```
cd target-project
git clone https://github.com/IamForma/forma.git protocol
```

Then in a Claude Code session opened in the target project:

```
read protocol/skills/forma/SKILL.md and install the Forma protocol by it
```

Update: `git -C protocol pull`, then "update the Forma protocol". The clone is a nested repository — its files do not enter your project's history.

### Way 3 — Claude Code plugin

```
claude plugin marketplace add IamForma/forma
claude plugin install forma@forma
```

Then in the project: "install the Forma protocol" (or `/forma`). If an update does not show up after `marketplace update`, the plugin cache is stale — switch to way 2.

### Node models

Set in the `model:` field of each role in `.claude/agents/`. Defaults:

| Node | Model |
|---|---|
| `Intent`, `Kit`, `Core` | `claude-opus-5-5` |
| `Spec`, `Run` | `claude-sonnet-5` |
| `extractor` (helper) | `haiku` |

Change a model by editing that line. The installer overwrites roles on update, so keep your change in a note or re-apply it after updating.

### Project templates

A template adds a ready route for a specific type of work on top of the core. Pick it in the installer (question 2) or install it separately:

| Template | For | As a plugin |
|---|---|---|
| [`forma-wordpress-novamira`](templates/forma-wordpress-novamira/README.md) | WordPress via Novamira MCP (+ Elementor), Aura/Magnific | `claude plugin install forma-wordpress-novamira@forma` |

With way 2 the templates are already in `protocol/templates/<name>/`: copy its `skills/` into `.claude/skills/`, then ask the agent to read `protocol/templates/<name>/skills/<name>/SKILL.md` and install the template by it.

### Kanban board (required)

```
code --install-extension LachyFS.kanban-markdown
```

The board `.devtool/features/` is where card status, history, results and spend live. Without it the dashboard, the graph and criterion checks have no data.

### After installation

- Dashboard: `node dashboard/serve.js` → `http://localhost:5050/`.
- Set the two thresholds (attempts, volume) in `project/config/PROJECT.md`.
- Start preparation from `project/config/SETUP.md` — the interview is led by `Intent`, the main session.

Optional companions: `skill-creator`, `context-mode`, `agentmemory` — see the full description.

## What it is

![Five nodes](assets/five-nodes.svg)

**Main thesis: an agent cannot check itself.** One agent working a long distance in one context does not break — it quietly degrades: impression replaces checking against fact, and the result drifts toward something similar but not the same. Forma answers with construction, not advice: five separate nodes, each with its own narrow role; every task is checked against a written criterion; **no node confirms its own work**.

The five are one body. Each judges by its own pair of criteria and has its own typical loss:

| Node | Judges | Holds | Loses, if the pair breaks |
|---|---|---|---|
| `Intent` | beautifully | justly | generalization |
| `Spec` | simply | completely | omission |
| `Kit` | naturally | lawfully | distortion |
| `Run` | honestly | humanely | substitution |
| `Core` | individually | the true path | the map isn't the territory |

Every loss looks reasonable at the moment it happens — so it is caught by a separate node, not by vigilance.

- **Route.** `Intent → Spec → Kit → Run → Intent`. There is no direct return to `Run`: `Kit` always reassembles the card.
- **Memory.** `Intent` is the main session with the human; `Spec`, `Kit`, `Run`, `Core` are isolated calls with no shared memory. Growth lives in files (`JOURNAL.md`, `VALUE.md`, skills), not in model memory.
- **Tools by role.** `Spec` and `Core` can only read and write files; tools that change the product go only into `Run`'s kit, for one task.
- **`Core`** stays aside: it steps in only on a breached threshold or when a cycle closes, and gives the verdict "reached / not reached".
- **Board.** The same five as a kanban: `Spec` → `Kit` → `Run` → `Intent`, with `Core` under all four.

The law is `AGENTS.md` (§1–7, English — the model's native language, ~39% fewer tokens). Explanations — `manual/en/`, `manual/ru/`.

## Full description

The previous, detailed README (why each rule, comparison with Karpathy Guidelines, reading levels, protocol development, versioning, repository structure, project preparation):

- English — [skills/forma/core/manual/en/archive/README-full-2026-09.md](skills/forma/core/manual/en/archive/README-full-2026-09.md)
- Русский — [skills/forma/core/manual/ru/archive/README-full-2026-09.md](skills/forma/core/manual/ru/archive/README-full-2026-09.md)

New engine adapter — [docs/ADAPTER.md](docs/ADAPTER.md).

## License

[MIT](LICENSE)
