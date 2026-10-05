# §8 · Codex runtime appendix

This is the Codex-specific appendix for the root `AGENTS.md`. It supplies facts that the common law delegates to §8; it does not replace, reinterpret, or weaken that law.

## Roles and routing

Custom subagent definitions are in `.codex/agents/*.toml`. For the five nodes, the complete semantic role is `.claude/agents/<name>.md`; `.codex/roles/<name>.md` is its Codex mechanics adapter. `.codex/CLAUDE-COMPAT.md` defines the translation and authority order. The root `AGENTS.md` remains the shared route and card law.

**On-demand layer: `.codex/roles/on-demand/`.** This is the directory the law refers to by bare filename (`intent-goal-opening.md`, `intent-housekeeping.md`, `run-external-model.md`, `kit-recon.md`, `kit-project-kitting.md`, `citing-schema-to-human.md`). A node reads one of these **only** when the law or its own role sends it there — never as standing context.

Each Codex on-demand file is a stable adapter pointing to the full canonical procedure in `.claude/agents/on-demand/`. The procedure is not copied, so Claude and Codex cannot silently drift into two semantic versions. Only engine mechanics are translated.

The project cap is **three child threads at once**. Together with the main session, that stays within this environment's four available slots. A platform that exposes a different capacity must not silently exceed this project cap.

| Role | Model | Reasoning effort |
|---|---|---|
| Intent | `gpt-5.6-sol` | `low` |
| Spec | `gpt-5.6-terra` | `low` |
| Kit | `gpt-5.6-terra` | `medium` |
| Run | `gpt-5.6-luna` | `low` |
| Core | `gpt-5.6-sol` | `low` |
| Extractor | `gpt-5.6-luna` | `low` |

The configured tiers are Intent/Spec/Core `low`, Kit `medium`, Run/Extractor `low`. Raising effort is an explicit per-task kitting decision and is recorded on the card.

`gpt-5.6` is not a valid selectable model on the current ChatGPT-backed Codex host. The selected models and tiers above are engine mappings, not changes to canonical Claude roles.

## Spend (§3)

Codex writes cumulative measured counters into its rollout transcript: the final `event_msg.payload.info.total_token_usage` carries `total_tokens` and `cached_input_tokens`. After a child returns, the caller runs `node .codex/scripts/codex-usage.cjs --file <rollout.jsonl> --complete --card <card.md>`. It takes only the final cumulative record, measures duration from `session_meta` to that record, reads the call id from `session_meta.payload.id`, rejects a duplicate id already in that card, and writes the common-law history line with the `codex:` tag. `session_meta.payload.source.subagent.thread_spawn` supplies the canonical child node name; a transcript without it is the main `Intent` session. `--report --write-cache` filters by the transcript cwd of this project, keeps main `Intent ↔ human` and subagent totals separate in `.forma/dashboard/.cache/codex-usage.json`, and marks every session unassigned until a caller binds it to a card. It never guesses a card. A field that the transcript did not return uses the markers in `AGENTS.md` §3, row "Unknown" and is counted separately, never as zero.

### Continuation of a live child

The choice between continuation and reassembly is canonical in `.claude/agents/kit.md`, "Return". For a permitted continuation, `Kit` first uses `list_agents` to confirm that the recorded child target is present. A running target receives the written correction through `send_message(target, message)`. A present target whose completed turn is reported as `completed`, or which is reported as idle, receives it through `followup_task(target, message)`, which starts its next turn in that same child context. The message contains only the correction required by the canonical role: the address, expected value, and boundary.

The target is the agent id or canonical child name recorded when `Run` was started. It is distinct from the rollout `session_meta.payload.id` used as the spend-line call id; the caller records the pair and does not infer one from the other. `followup_task` addresses the existing child by that preserved id or name; a completed turn therefore does not itself mean a closed or lost context. Only a target positively present as running, idle, or completed can be continued. An absent, lost, or errored target takes reassembly with a new `Run`. A send result and a later running snapshot are not evidence of a completed attempt: the caller waits for the child return before checking it.

Before sending the correction, record the timestamp of the latest `token_count` snapshot from the completed prior child turn. After the continued turn returns, write its spend with `node .codex/scripts/codex-usage.cjs --file <rollout.jsonl> --complete --continuation --after <prior-token-count-timestamp> --card <card.md>`. The script subtracts the named prior cumulative snapshot from the final returned one, keeps that transcript's call id, writes `attempt (continuation)` with the `codex:` tag, and stores an idempotence marker for that id-and-boundary segment. The boundary must be the end of the most recently recorded segment with that call id on the card. Its duration is the measured wall-clock span between those snapshots. It never records the full cumulative call a second time. If the target-to-transcript pair or the prior completed snapshot cannot be confirmed, it writes no measured continuation line: the missing measurement is recorded as `unknown` under §3, or the route stops, without an estimate.

## Skills

Codex discovers project skills from `.agents/skills/`. Each project skill canonical in `.claude/skills/` is mirrored there with its complete directory, so its `SKILL.md` and all relative resources resolve through Codex's supported project path. `verify-parity.ps1` compares the dynamic skill set and every mirrored file hash against the canonical source; a junction would be equivalent, but this workspace does not permit creating one. `kanban-markdown` remains native in `.agents/skills/`. System-provided skills are supplied by the Codex host and are not copied into the repository. A task that needs a skill not actually present stops for kitting rather than inventing one.

## MCP

Project MCP servers are project-specific: the template configures none. `Kit` or the human adds them to `.codex/config.toml` (`[mcp_servers.*]`) after the kitting decision, mirroring the Claude project MCP files. No MCP server is implied by this appendix. A tool mentioned by a canonical role is unavailable unless the live Codex session exposes it. Credentials remain only in the root `.env` as required by prohibition 15.

## Deletion guard

Codex supports project-local hooks. This repository enables `.codex/hooks.json`, which runs readiness, dashboard, and Forma-plugin checks at session start, `.codex/hooks/guard-delete.ps1` before destructive-capable shell/patch calls, and `.codex/hooks/tool-usage.ps1` on every `PreToolUse`. The PowerShell journal hook is the Codex equivalent of Claude's `.claude/hooks/tool-usage.sh`: both append `timestamp · node · agent_id · tool_name` to `.forma/dashboard/tool-usage.log` and record malformed input as `!ОШИБКА`. The guard blocks destructive requests aimed at `.claude/`, `.agents/`, `.codex/`, `.devtool/`, `.forma/manual/`, `.forma/living/`, `VARS/`, `AGENTS.md`, `CLAUDE.md`, `.agents/rules/gemini-8.md`, `PROJECT.md`, `CODEX-8.md`, or any `GOAL.md`.

The human's literal phrase `Отключи сенсорику` grants one deletion exception under the common law. Only after that phrase may the addressed node create `.codex/hooks/.delete-unlock`; the guard consumes that marker during the next matching destructive call. The marker is ignored by Git.

The guard is a project safeguard, not a substitute for Codex permission prompts or the runtime sandbox.

## Verification

Run `.codex/tests/verify-config.ps1` after changing Codex configuration. It checks the agent files, role references, appendix, MCP configuration, hook JSON, both deny/allow paths and the one-use marker of the deletion guard, and a real journal entry from the Codex tool-usage hook. Run `node .codex/tests/test-sync-codex.cjs` to prove that model, role-link, skill, hook, usage attribution, and template drift all fail the synchronization check.

## Zone of edits

Role adapters under `.codex/roles/` are carried over from Claude Code mechanically by `node .claude/scripts/sync-engines.cjs --apply` (Claude → Codex: a missing adapter is created from the standard template; existing adapters are not touched) — that carry-over is sanctioned; no other engine edits `.codex/` by hand.

## Main session = `Intent` (§1)

The main Codex session is `Intent`. Before its first reply it reads `.claude/agents/intent.md` through the Codex adapter and, at session start, `.claude/agents/on-demand/intent-session-start.md`. The `SessionStart` hook `.codex/hooks/intent-start.ps1` injects both canonical bodies as `additionalContext` and shows the human the dashboard link (`systemMessage`); the `PostToolUse` hook `.codex/hooks/check-card.ps1` (matcher `apply_patch`) runs `sync-engines --check` on a board card the moment it is written. Both are thin wrappers over `.codex/scripts/codex-hooks.cjs`; registered in `.codex/hooks.json`. Cards are created with `node .forma/board/new-card.cjs`.
Kit selects one canonical Run profile and supplies its profile body together with the supported Codex `run` agent's base and adapter. The dashboard listing of the seven canonical profile source files does not create dynamic custom-agent roles; profiles are not declared automatically as custom agents.
