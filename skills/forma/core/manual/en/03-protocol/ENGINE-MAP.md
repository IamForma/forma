# Engine map — the full unfolding of the core

The engine is everything that makes the route run: the rules, the machinery that applies them, the settings, the counting. What the engine **produces** in a project (cards, goals, theme, pages, images, site content) is not the engine. This page lists the engine completely, so that nothing in it is lost from sight, and names the places to keep improving. Sizes are approximate (measure with `node .claude/scripts/instruction-weight.cjs`; the size gate is `checks/rules-size.cjs`).

Reading order of a node: the law, then the engine's §8, then its own role file, then the on-demand files its role points to, at the event they describe. A rule that lives only in this manual does not exist for a node — agents do not read the manual along the way.

---

## 1 · Rules — three levels

### Level 1 — the law (every node, every session)

| File | About | Size |
|---|---|---|
| `AGENTS.md` | sections 1–7: five pairs, route, thresholds, position marker, prohibitions 1–18, card, board. Whatever one node alone applies is cut out and left as a pointer «gist + file» | ~14 KB |
| `.claude/rules/claude-8.md` (and `.agents/rules/gemini-8.md`, `.codex/CODEX-8.md`) | §8 — the engine's own architecture: how roles are delivered, the Plumb executors, automatic recording, hooks, permission levels | ~9 KB |

### Level 2 — roles (the node that works)

| File | Node | Size |
|---|---|---|
| `.claude/agents/intent.md` | `Intent` — end-image, every-request rules, the main session | ~22 KB |
| `.claude/agents/spec.md` | `Spec` — slicing, Plumb reading | ~18 KB |
| `.claude/agents/kit.md` | `Kit` — six units, role creation, corrections | ~37 KB |
| `.claude/agents/run.md` | `Run` — execution | ~14 KB |
| `.claude/agents/core.md` | `Core` — thresholds, cycle verdict | ~19 KB |

Weight of one node before any on-demand file: law + §8 + role — `Intent` ~44 KB, `Spec` ~41 KB, `Kit` ~60 KB, `Run` ~37 KB, `Core` ~42 KB.

Every rule moved out of the law into a role or on-demand file begins with the marker `<!-- moved-from-law: <key> -->`. The check `checks/law-pointers.cjs` requires every role file named in the law to exist and to carry such a marker.

### Level 3 — on-demand (read at the event)

| Group | Files | About |
|---|---|---|
| Common | `card-and-board.md`, `route-choice.md`, `spend-line.md`, `degraded-mode.md`, `citing-schema-to-human.md` | card fields and stages, board moves, human-row trace, credentials; route choice; the spend line; an engine without separate agents; quoting a schema |
| `Intent` | `intent-goal-opening.md`, `intent-housekeeping.md`, `intent-session-start.md`, `intent-demo.md`, `intent-cycle-closing.md`, `intent-visual-check.md`, `intent-documentation.md`, `intent-emergency.md` | goal interview and epics; delete-guard, clean zones, narrow exception; start gate; demo; cycle closing; visual check; documentation; emergency |
| `Spec` | `spec-slicing-details.md`, `spec-trial-pilot.md`, `spec-route8.md`, `spec-unattainable-value.md`, `spec-statistics.md`, `spec-cycle-boundary.md` | slicing detail; trial pilot; route-8; unattainable value; statistics; cycle boundary |
| `Kit` | `kit-project-kitting.md`, `kit-recon.md`, `kit-arsenal.md`, `kit-limits.md`, `kit-graphs.md`, `kit-route8.md`, `kit-experience.md` | kitting a project; reconnaissance; arsenal; limits; graphs; route-8; experience |
| `Run` | `run-external-model.md` | the external channel |

Together ~26 files, ~130 KB. The node-to-file links are in the «Every request» table of `intent.md` and in the list at the end of each role.

---

## 2 · Rule-like sources outside the three levels

Not law, but a node reads or obeys them, so they are part of the engine.

| Source | Where | What it holds |
|---|---|---|
| Run profiles | `.claude/agents/run/*.md` | the catalog of executors: a «takes / does not take» line each; read by the Plumb and by `Kit`. Template profiles ship with the protocol; a project's own profiles come from `project/extensions/` |
| Service agents | `plumb-haiku.md`, `extractor.md`, `asset-describer-haiku.md` | the built-in Plumb executor, a text extractor, an image describer |
| Skills | `.claude/skills/` | `human-register`, `skill-authoring`, `graph-build`, `grilling`, `forma-grill-with-ui`, `project-knowledge` and product skills; the roles name them |
| Project profile | `project/config/PROJECT.md` | thresholds, routes, Plumb executor and its thresholds, external services, project epics — settings, not rules |
| Credentials | `project/VARS/credentials.md`, `.env` | access, by prohibition 15 |
| Permissions | `.claude/permission-levels.json`, `.claude/settings.json` | access levels and hook registration |
| Protected paths | `.forma/rules/protected-paths.json`, `guard-delete.cjs`, `guard-core-cycle.cjs` | what the delete-guard blocks |

---

## 3 · Machinery

| Part | Where | What it does |
|---|---|---|
| Board | `.forma/board/` | `new-card.cjs`, `card-move.cjs`, `run-in-card.cjs`, `check-board.cjs` with `checks/` (labels, stages, epics, spend format, ledger parity, closing), `DATA-MODEL.md` |
| Plumb driver | `.forma/plumb/plumb-run.cjs`, `.claude/scripts/plumb-*.cjs` | scrub, call, measure, switch the executor |
| External bridge | `.claude/scripts/external-model-bridge.cjs` | the only way out to an external model, after scrubbing |
| Engine checks | `.claude/scripts/sync-engines.cjs`, `checks/` | law shape, adapter parity, law pointers, size gate, impersonal engine files, delivery |
| Dashboard | `.forma/dashboard/` | data (`data/`), web (`web/`), tally, economy, floor, speed, dialog, structure, locales, tests |
| Counting | `claude-economy.cjs`, `session-economy.cjs`, `card-session-spend.cjs`, `ledger-recorder.cjs`, `tool-usage.cjs`, `.claude/.ledger/` | spend lines by fact, per-call ledger, tool log |
| Graphs | `build-kit-graphs.cjs`, `build-engine-graph*.cjs`, `build-tendons.cjs`, `graph-query.cjs`, `auto-graphs.cjs`, `resources.cjs`; output `.forma/living/graphs/` | mechanical graphs, no model |
| Extensions | `.forma/extensions/`, `project/extensions/` | template and custom layers copied into the engine folders |
| Engines | `.forma/engines.json`, `engine-switch.cjs`, `.forma/dashboard/lib/engines.cjs` | the engine contract, dormant engines |
| Protocol clone | `.forma/protocol/`, `engine-to-protocol.cjs`, `.forma/verify/` | carrying engine files into the shipped protocol, release checks, install verification |
| Localization | `.forma/i18n/`, `.forma/dashboard/locales/` | two languages, `locale-parity` |
| Living records | `.forma/living/` | changelog, dictionary, migrations, checks record |

### Hooks (as registered in `.claude/settings.json`)

| Event | Hook |
|---|---|
| `PreToolUse` | `guard-delete.sh`, `tool-usage.sh` |
| `UserPromptSubmit` | `unlock-delete.sh` |
| `SessionStart` | `check-ready.sh`, `check-plugin-update.sh`, `check-dashboard.sh`, `intent-start.sh`, `card-assets-sweep.cjs` |
| `PostToolUse` (Write, Edit) | `check-card.sh`, `sync-extensions.sh`, `auto-graphs.sh` |
| `PostToolUse` (Bash, MCP) | `card-assets-sweep.cjs` |
| `SubagentStop`, `SessionEnd` | `ledger-recorder.cjs`, `card-session-spend.cjs --auto` — described in `claude-8.md`, **not found in `.claude/settings.json`** (section 5, item 1) |

---

## 4 · What the engine produces — not the engine

Cards (`.devtool/features/`), goals, brief, card materials (`project/cards/`), experience, ADR, the site theme and its build tools, mockups, deploy and site scripts, translation and page-assembly scripts, images. Scripts of product work kept in `.claude/scripts/` (site, translation, page assembly, CSS audit) are tools of a project, not of the engine.

---

## 5 · Gaps found and where to keep looking for improvement

Found while unfolding the engine — verify each, then fix or record:

1. **Automatic recording may be off.** `claude-8.md` says `SubagentStop` and `SessionEnd` hooks write the call ledger and the session spend line; `.claude/settings.json` registers neither, and `.claude/.ledger/` does not exist. Either the installed plugin supplies these hooks, or spend lines are written by hand only. Confirm and register.
2. **`check-clean-zone.sh` is not registered** in `.claude/settings.json` (prohibition 16 says a write hook reports a project trace). Confirm whether it must run.
3. **A stray comma in a file name** in the credentials folder (`credentials.md,`): the reference `VARS/credentials.md` resolves to nothing. Rename after checking what points to it.
4. **Dangling «§6» references** for the Plumb line remain in `spec.md` and `core.md` (§6 of the law holds the card form, not that rule); point them at `card-and-board.md`.

Further places to improve:

5. **Weight of a node.** `Kit` is the heaviest (~60 KB before any on-demand); the largest role (`kit.md`) and the largest on-demand file (`intent-goal-opening.md`) are the first candidates to split by event.
6. **§8 is read by everyone.** Parts of it apply to the main session or to one node only; cut them to the role or to on-demand with a pointer, as was done with the law.
7. **One source per rule.** A rule restated in two files drifts. Where a role needs a rule, keep a pointer, not a copy.
8. **Role references.** The law-pointers check covers the law only; extend it to every «§N» and file name in the roles.
9. **Engine vs product tools.** Move product-work scripts out of `.claude/scripts/` so the engine folder holds only the engine.
10. **Run profiles.** Keep the template catalog small and distinct; a profile that the Plumb cannot tell from a neighbour is a defect of the catalog.
11. **Counting.** The numbers of §3 of the law (spend, time, share of cards needing `Kit`) are read by `Core` as a trend; keep each source of a number single and documented in `ECONOMY.md`.
