# Codex configuration

This directory contains the project-scoped Codex subagent definitions.

- `config.toml` sets shared subagent limits and root instruction pointers; each installed project adds only its own MCP servers.
- `CODEX-8.md` supplies the verified Codex-specific facts that the shared protocol delegates to §8.
- `CLAUDE-COMPAT.md` maps the complete canonical Claude roles onto Codex mechanics without copying their bodies.
- `agents/intent.toml`, `spec.toml`, `kit.toml`, `run.toml`, and `core.toml` implement the five Form nodes; `extractor.toml` mirrors the mechanical helper.
- `roles/` contains Codex adapters. Full semantic role bodies remain canonical in `.claude/agents/`; `roles/on-demand/` points to the canonical lazy procedures.
- `hooks.json` and `hooks/*.ps1` mirror readiness, dashboard, plugin-update, deletion-guard, and per-tool journal behavior. `tool-usage.ps1` is the PowerShell equivalent of Claude's `tool-usage.sh` and writes the same journal format.
- `tests/verify-parity.ps1` checks the Claude-to-Codex alignment; `tests/verify-config.ps1` additionally exercises the deletion guard.
- `scripts/codex-usage.cjs` reads measured final usage from Codex rollout transcripts, separates main and child sessions, and writes a card only with an explicit binding.
- `tests/verify-config.ps1` validates this configuration and the guard's deny/allow paths.
- The project-wide rules remain in the root `AGENTS.md`; they are loaded by Codex automatically and are not duplicated here.

The configured nodes are: `Intent` `gpt-5.6-sol`/`low`; `Spec` `gpt-5.6-terra`/`low`; `Kit` `gpt-5.6-terra`/`medium`; `Run` `gpt-5.6-luna`/`low`; `Core` `gpt-5.6-sol`/`low`; `Extractor` `gpt-5.6-luna`/`low`. Each TOML explicitly uses `workspace-write`.

Semantic parity is maintained by reference, not duplicated text: when a Claude role changes, Codex reads that changed role directly. Engine-only differences are listed explicitly in `CLAUDE-COMPAT.md` and `CODEX-8.md`.

The packaged Codex files live in `protocol/skills/forma/adapters/codex/`; older plugin packages use `templates-codex/`. `FORMA_PLUGIN_ROOT` selects another plugin root.

Run `node .codex/scripts/sync-codex.cjs --apply` to regenerate the Codex adapters and skill mirrors. Run the same command with `--check` to detect drift, followed by `node .codex/tests/test-sync-codex.cjs`, `.codex/tests/verify-config.ps1`, and `.codex/tests/verify-parity.ps1` for positive and negative verification.

Codex natively discovers repository skills from `.agents/skills`. Claude-canonical project skills are mirrored there with all relative resources; `verify-parity.ps1` prevents this required, host-supported copy from silently drifting.

Synchronize generated Codex files with `node .codex/scripts/sync-codex.cjs --apply`; use `node .codex/scripts/sync-codex.cjs --check` in automation to detect drift.
