# Developing the protocol from a project

Any project can improve the protocol, not only receive it. An improvement made and proven in a project's engine travels to the source repository `IamForma/forma` in a fixed order. Write access to that repository is required; without it the clone is read-only and none of this applies.

## What goes in, what stays

- **Goes in:** a change to the method — roles, profiles, skills, scripts, hooks, rules, manual, dashboard — that carries no fact of one product.
- **Stays:** `project/`, `.forma/living/`, the board, cards, goals; scripts tied to one product (card codes, site paths); model and effort settings chosen for this project only.
- **A project in another language** differs from the template by translation, not by improvement. Never run `--apply` over it whole: it would overwrite the template with translated text. Move chosen files with `--add`.

## Steps

1. **Deploy the clone** (once per project). From the project root:
   `git clone --branch dev https://github.com/IamForma/forma .forma/protocol`
   and add `.forma/protocol/` to `.gitignore`. The clone is a nested repository; it must not enter the project's commits.
2. **Prove the change in work** in the project's engine (`.claude/`, `.forma/`, `AGENTS.md`).
3. **Align the other engines** with Claude, the reference: `node .claude/scripts/sync-engines.cjs --check` (`--diff` shows lines). Each engine fixes its own zone — Codex in `.codex/` and `.agents/skills/`, Gemini in `.agents/` — from a written prompt; Claude does not edit them by hand. Run the check again after they finish: no `✗ Drift` row, no Codex or Gemini remarks.
4. **Dry run:** `node .forma/protocol/scripts/engine-to-protocol.cjs` — writes nothing, sorts every file:
   - *changed only in the engine* — will move with `--apply`;
   - *changed only in the template* — comes with "update the Forma protocol", not moved;
   - *both changed* — a conflict, the human decides;
   - *new in the engine* — moves only by `--add <path>`.
5. **Transfer:** `--apply --add <path> [--add …]` — only the files that are improvements. Product-specific files are left out.
6. **Check traces:** in the clone, `node scripts/check-release.cjs --traces` (files) and `--prepush` (files and unsent commit messages). Card codes, dates, domains, hashes, a broken `.forma/…` path — each is a stop (prohibition 16). Fix the file, repeat.
7. **Version:** raise the next patch in `.forma/protocol/.claude-plugin/plugin.json`.
8. **Commit in the clone:** `git -C .forma/protocol add -A && git -C .forma/protocol commit -m "<version>: <what changed>"`, then `node .forma/protocol/scripts/engine-to-protocol.cjs --mark` (records the base for the next dry run).
9. **Before the push:** `git -C .forma/protocol pull --rebase`, then `node .forma/protocol/scripts/engine-to-protocol.cjs --before-push` — stops if the version is not above the published one or the branch is behind. The same version on both sides merges silently; this check catches it.
10. **Push:** `git -C .forma/protocol push origin dev`. Only on the human's word — an agent never pushes on its own. The release to `main` is a separate step.
11. **Other projects:** `git -C .forma/protocol pull`, then "read `.forma/protocol/skills/forma/SKILL.md` and update the Forma protocol by it". Pulling alone updates the clone, not the engine in `.claude/`. The author then runs `--mark`.

`node .forma/protocol/scripts/forma-commit.cjs "<message>"` chains the checks, the transfer and the commits in one call and stops on a conflict; use it when the project is the author's main one.

## Where the tests run

Tests live in two layouts; each runs only in its own.

- **Clone tests** (`test/**/*.test.cjs`): `npm test` in `.forma/protocol`. This is the release criterion for the clone.
- **Layout tests** (next to the scripts they check: `.forma/board`, `.forma/dashboard`, `.forma/i18n`, `.forma/plumb`, `.claude/scripts`, `.agents/tests`): written for the installed layout, so they run in the project, never in the clone. Their template copies sit under `skills/forma/core` and `skills/forma/adapters`, where the relative paths do not exist — a bare `node --test` in the clone reports them red. That is the layout, not a defect.

Before step 6, in the project: `node --test` over the layout tests above, plus `node .claude/scripts/checks/support/test-gen-gemini-roles.cjs` (a new or edited role without its Gemini copy shows as drift; `sync-engines.cjs --apply` regenerates it). Both must be green.

## Record

Run the work as a card of the "3. Project protocol" epic: the transfer, the trace check and the push are written in its `## Result`. A change to a file the card did not name is a new card, not an addition to an accepted one.

## Removing the protocol

`node .forma/protocol/bin/forma.cjs uninstall [--dir <path>] [--yes]` (or `npx github:IamForma/forma uninstall`). Dry run by default: prints what goes and what stays. `--yes` writes.

Files in `.claude/` that are not part of the release are the project's own work. The dry run lists them; `--yes` moves them to `project/extensions/<engine>/` before removing the engine, and the next install copies them back. Where the project's own roles, skills and scripts live, and how they reach the engine folders — `project/extensions/README.md`; `node .forma/extensions/extensions.cjs [sync|check]`.

- **Removed:** `.claude`, `.codex`, `.agents`, `.forma`, `AGENTS.md`, `.env.example`, the installer's lines in `.gitignore`, the `.forma/protocol` gitlink in the index.
- **Stays:** `project/`, `.devtool/`, `.env`, `.mcp.json`, `.playwright-cli/`, the product's code.
- **From a session:** `Intent` shows the dry run and applies `--yes` only after the human's message with the code phrase «Отключи сенсорику» (it lifts the delete-guard once).
