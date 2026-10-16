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

The configured reasoning efforts are Intent/Spec/Core `low`, Kit `medium`, Run/Extractor `low`. Raising effort is an explicit per-task kitting decision and is recorded on the card.

`gpt-5.6` is not a valid selectable model on the current ChatGPT-backed Codex host. The selected models and reasoning efforts above are engine mappings, not changes to canonical Claude roles.

## Plumb runtime (§2, §5 prohibition 17, §6)

Plumb is a measurement helper, not a sixth node. It takes no independent card, decides nothing and confirms nothing. Every invocation is tied to an already opened task card, including Kit's retest.

**Built-in executor:** `.codex/agents/plumb.toml`, contract `.codex/roles/plumb.md`, model `gpt-5.6-luna`, effort `low`, sandbox `read-only`. Intent invokes `collaboration.spawn_agent` with `task_name: "plumb"`, `agent_type: "plumb"`, `fork_turns: "none"` when that native definition is exposed. Supply only the scrubbed five Task fields and catalog criteria, inline or by explicitly listed input files; no full card, parent conversation, goals, project configuration or credentials. Reading those inputs is its only permitted action. A TOML sandbox is not a tool allow-list: shell, network, writes and delegation are also forbidden by the helper contract.

**Host capability:** inspect live agent types. If `plumb` is not exposed, a default agent can be called with `fork_turns: "none"`, `model: "gpt-5.6-luna"`, `reasoning_effort: "low"` and the complete helper contract in its prompt. This restricts behavior, not the platform's tool manifest. Codex has no supported equivalent here of omitting automatically delivered project instructions: `fork_turns: "none"` removes parent conversation, not host instructions. Name this limitation before using that path; strict context/tool isolation unavailable → return the missing capability to Kit. Never claim an omitted project context or a sandbox the live call did not expose.

Automatically loaded project instructions may enter the built-in executor's context even with the native Plumb definition and no parent history. Compensation is a scrubbed five-field task and criteria-only catalog, a native read-only sandbox, explicit prohibition of writes/network/shell/delegation, and readings judged only against the supplied criteria. These controls reduce exposure and side effects; they cannot guarantee an empty project context, erase host-injected instructions, or prove that such instructions had no effect on the model's readings. The default-agent path additionally cannot guarantee the native read-only sandbox or a read-only tool allow-list.

**Caller and decision:** when Spec cannot call agents, Spec returns sliced cards and a measurement request; Intent prepares inputs, calls Plumb, validates its JSON and reads that call's measured metadata, then returns readings and metadata to Spec. Spec decides by leading probability, gap, leader noul and clarity thresholds and immediately writes the history line. Malformed JSON is an executor error, never a guessed fit. Kit retests a new or corrected role through the same caller and contract. Core only reads recorded divergences at closing.

**Cleaning:** first run `node .claude/scripts/plumb-scrub.cjs <card>` — shared machinery, never copied into `.codex/`. Accept only exit 0, `ok: true` and a nonempty task. History, Kit and Result never leave the card. Record replacement types/counts and refusal reasons without values. Build the catalog from descriptions, `When to take` and `Takes / does not take`, including product profiles registered in PROJECT.md, “Профили Run проекта”. Before an external send, the entire outgoing payload including catalog criteria must pass the shared scrubber's allow-list and residue check; never send raw product profile files. A model never performs the cleaning.

**Selection and fallback:** read `plumb: haiku | jev` and thresholds from PROJECT.md (“Routes” / “Маршруты”). `haiku` is its existing built-in selector; in Codex it resolves to `plumb` / `gpt-5.6-luna`, never a Claude model. Record executor `codex-plumb`, with thresholds calibrated for that actual executor. Missing Codex calibration is a named configuration question for Spec/Intent; never substitute Claude's measured accuracy or invent portable project thresholds.

For `jev`, run `node .claude/scripts/plumb-run.cjs <card>` — shared transport, like `plumb-scrub.cjs`, never copied into `.codex/`. It scrubs the task and catalog, calls the OpenRouter Decisions API through `external-model-bridge.cjs`, and prints `{choice, score, noul, meta}`. The bridge reads `OPENROUTER_API_KEY` from root `.env`; never expand the key into a shell command. Before calling, check the paid service's third cycle limit, in calls; a missing or reached limit stops that external branch. A missing key, bridge error, invalid response or scrub refusal prints `{"fallback":"haiku","reason":...}` and exits with 0: exit 0 alone is not a measurement. On that response Intent calls the built-in Plumb (`gpt-5.6-luna`/`low`), and Spec records the reason in card History. Scrub refused/raw content is never sent externally; obtain safe five-field input for the in-family fallback and return a missing Task zone to Spec. The selector is changed with `node .claude/scripts/plumb-switch.cjs`. Claude's measured `jev` thresholds are not Codex calibration: leave their applicability and Codex thresholds as a named question for Spec/Intent, without copying numbers. `plumb-scrub.cjs` cleans and `plumb-measure.cjs` prepares/scores calibration data; the external transport is `plumb-run.cjs`.

**Output and route:** `choice` (catalog probabilities summing to 100), `score` (clarity 0–4), `noul` (fit 0–1 for the top two). Spec applies executor-specific thresholds: fitting role → full six-unit kit, `route-2`, `why: plumb`; low fit → Kit creates the exact role; low clarity → Spec restates once, then returns the named ambiguity. Human approval for `route-0`…`route-5` still holds. `why: ready` remains for a card already complete with its kit.

**Native profile ownership:** Kit may create a portable Codex profile in `.codex/roles/run/` with frontmatter `origin: codex`, Takes / does not take examples and Boundary, plus a matching native TOML. The synchronizer preserves such profiles, including an explicitly owned correction, instead of overwriting Kit's work from a different engine. They enter the same Plumb catalog and retest. Product-specific facts and profiles remain in the project's own catalog registered in PROJECT.md; they are never imported into this portable layer.

**Spend:** Spec writes `` `Plumb`, YYYY-MM-DD: attempt, N tokens (R cache-read), T s, `<call id>` — codex: role <name>, N % (gap G, clarity C), <executor>, <fits / below threshold / returned>. `` Read N/R/T/id from that call's matched Codex rollout, never from its estimated probabilities. `codex-usage.cjs` recognizes native `plumb` and writes this line with `--desc` carrying the reading and scrub counts. A default-agent fallback requires verified task-to-transcript binding and the same measured fields attributed to Plumb, never Intent or Run. External spend uses the provider response's own-unit segment before the call id and dash; unavailable fields follow the inspected `unknown` procedure. Tokens and elapsed time stay statistics. A paid external executor adds the third cycle limit; absent paid services add none.

## Spend (§3)

Codex writes cumulative measured counters into its rollout transcript: the final `event_msg.payload.info.total_token_usage` carries `total_tokens` and `cached_input_tokens`. After a child returns, the caller runs `node .codex/scripts/codex-usage.cjs --file <rollout.jsonl> --complete --card <card.md>`. It takes only the final cumulative record, measures duration from `session_meta` to that record, reads the call id from `session_meta.payload.id`, rejects a duplicate id already in that card, and writes the common-law history line with the `codex:` tag. `session_meta.payload.source.subagent.thread_spawn` supplies the canonical child node name; a transcript without it is the main `Intent` session. `--report --write-cache` filters by the transcript cwd of this project, keeps main `Intent ↔ human` and subagent totals separate in `.forma/dashboard/.cache/codex-usage.json`, and marks every session unassigned until a caller binds it to a card. It never guesses a card. A field that the transcript did not return uses the markers in `AGENTS.md` §3, row "Unknown" and is counted separately, never as zero.

For one batch call, bind each touched card separately with the same transcript and `--split K --share I --desc "<what this card received>"`. The utility divides measured N, R and T by K using exact integer shares (the remainder goes to the first shares) and appends `(batch I/K)` to every description. `Spec` may slice several cards in one call; `Kit` may kit up to four independent related cards. This is Codex transcript accounting, never a Claude usage reader.

### Continuation of a live child

The choice between continuation and reassembly is canonical in `.claude/agents/kit.md`, "Return". Kit writes the correction and returns it to the main session; Kit never calls collaboration tools. The main session uses `collaboration.list_agents` to confirm the same still-running call, then sends only the address, expected value and boundary through `collaboration.send_message`. A returned, closed, idle, lost or errored call requires reassembly. `followup_task` is not the canonical live-call exception.

The agent target id recorded at invocation is distinct from the rollout `session_meta.payload.id` used for spend. The caller records their verified pair and never infers one from the other. The caller waits for the child return before checking the attempt.

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

Codex owns `.codex/`; it never edits `.claude/`, `.agents/` or GEMINI.md by hand. A shared-law discrepancy is named before an AGENTS.md edit. For a Codex-only refresh use `node .codex/scripts/sync-codex.cjs --apply --codex-only`; it writes generated `.codex/` role and agent files plus `generated-skill-mirror.json`, and never writes `.agents/skills/`. Without flags and with `--check` the command is read-only. Full `--apply` also owns the shared skill mirror and must not be used for a Codex-only assignment.

## Main session = `Intent` (§1)

The main Codex session is `Intent`. Before its first reply it reads `.claude/agents/intent.md` through the Codex adapter and, at session start, `.claude/agents/on-demand/intent-session-start.md`. The `SessionStart` hook `.codex/hooks/intent-start.ps1` injects both canonical bodies as `additionalContext` and shows the human the dashboard link (`systemMessage`); the `PostToolUse` hook `.codex/hooks/check-card.ps1` (matcher `apply_patch`) runs `sync-engines --check` on a board card the moment it is written. Both are thin wrappers over `.codex/scripts/codex-hooks.cjs`; registered in `.codex/hooks.json`. Cards are created with `node .forma/board/new-card.cjs`.
Spec selects a Plumb-confirmed profile and issues its kit; Kit creates or corrects a profile on a low reading or return. Intent supplies the selected profile with the supported Run agent's base and adapter. Portable profiles include local Python execution. Product-only profiles are read from PROJECT.md and stay outside portable adapters and protocol packaging; a dashboard listing does not create a native custom agent.

Only the main session dispatches Run through `collaboration.spawn_agent` and sends a correction through `collaboration.send_message` to the same still-running call. Kit returns the finished six-unit kit or written correction to the main session and never invokes collaboration tools itself. A returned or closed call requires reassembly; `followup_task` is not the live-call exception.
