# Claude to Codex compatibility contract

This file makes the Claude configuration semantically available to Codex without copying and drifting from it. It is an engine adapter, not a second protocol.

## Authority order

1. Root `AGENTS.md` is the common law.
2. The body of `.claude/agents/<role>.md` is the canonical full role instruction for `Intent`, `Spec`, `Kit`, `Run`, `Core`, and `extractor`.
3. `.codex/roles/<role>.md` translates that role into Codex mechanics and may only add verified Codex-specific differences.
4. `.codex/CODEX-8.md` is section 8 for Codex.

Claude YAML frontmatter, Claude model names, allowlists, plugin commands, and tool identifiers are not executable Codex configuration. The matching TOML file in `.codex/agents/` controls the Codex model and sandbox.

## Mechanical translation

| Claude instruction | Codex equivalent |
| --- | --- |
| `Read`, `Grep`, `Glob` | inspect files with Codex filesystem/search tools; prefer `rg` |
| `Write`, `Edit` | edit within the active sandbox; use the Codex patch mechanism |
| `Bash`, `PowerShell` | the available Codex shell tool |
| `AskUserQuestion` | ask the human only where the route permits that node to speak |
| native `Agent` | a named Codex custom-agent thread from `.codex/agents/*.toml` |
| `SendMessage` to a live child | `send_message` for a running target; `followup_task` for a present completed/idle target after `list_agents` confirms the same child context |
| Claude skill | read the named project `SKILL.md` completely when the kit selects it; translate only engine mechanics |
| Claude MCP tool | use the corresponding Codex MCP only when it is actually exposed in the current session |

Tool absence is a fact, not permission to substitute. Return it through the route as an environment limitation or stop, exactly as the canonical role says.

## On-demand instructions

The canonical procedures are `.claude/agents/on-demand/*.md`. Matching files under `.codex/roles/on-demand/` are stable Codex entry points. A role reads an on-demand procedure only when its canonical role tells it to, then applies the translation table above.

## Tools and skills

- Project scripts under `.claude/scripts/` remain project tools and may be executed when the card kits them; their directory name does not make their behavior Claude-only.
- `kanban-markdown` lives at `.agents/skills/kanban-markdown/SKILL.md` and must be read before board operations.
- Host/system Codex skills are environment resources. Their availability must be checked from the current session, not inferred from Claude settings.
- Project MCP servers and host tools are usable only if the installed project's configuration and the current Codex session expose them. Their mention in a Claude role is not evidence that Codex has them.

## Intentional engine differences

- Claude's model labels are replaced by the model and reasoning tier declared in each Codex agent TOML.
- Codex has four total collaboration slots in this environment: the primary session plus at most three child threads.
- Codex rollout transcripts expose measured cumulative `total_tokens` and `cached_input_tokens`. `.codex/scripts/codex-usage.cjs` reads the final snapshot once, filters the report by project cwd, keeps `Intent` ↔ human and child sessions separate, and writes a card only after explicit `--complete --card` binding; see `CODEX-8.md`, “Spend (§3)”.
- A live child can receive a continuation correction. `CODEX-8.md`, “Continuation of a live child”, maps the canonical continuation procedure to `list_agents`, `send_message`, and `followup_task`; a target that is no longer live takes the canonical reassembly path. Continuation usage is the measured delta after an explicit prior token-count snapshot, under the rollout call id; the agent target id and that transcript id are recorded separately.
- Codex deletion protection is implemented by `.codex/hooks/guard-delete.ps1`, not Claude's shell hook.
- Claude journals tool attempts with `.claude/hooks/tool-usage.sh`; Codex uses `.codex/hooks/tool-usage.ps1`. They intentionally differ only in shell language and host input mechanics and write the same `dashboard/tool-usage.log` record shape.
