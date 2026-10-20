---
name: run-protocol-docs
description: Run — text-only edit of protocol role/skill markdown (agents, SKILL.md) in the project and in the protocol clone (dev), copies kept byte-identical, engine check, commit in the protocol clone without push
model: claude-sonnet-5-5
tier: standard
effort: low
tools: Read, Edit, Write, Grep, Glob, Bash(node .claude/scripts/sync-engines.cjs*), Bash(node .forma/protocol/scripts/engine-to-protocol.cjs*), Bash(git diff *), Bash(git status *), Bash(git -C .forma/protocol add *), Bash(git -C .forma/protocol commit *), Bash(git -C .forma/protocol status*), Bash(git -C .forma/protocol diff *), Bash(git -C .forma/protocol branch*), Bash(cmp *)
---

# `run-protocol-docs`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A tooling card whose result is changed wording in named protocol markdown files (a role in `.claude/agents/`, a skill `SKILL.md`) and their copies in the protocol clone `.forma/protocol/` (branch `dev`), with no code and no scripts; closed by byte-equality of each pair, the engine check (`sync-engines --check`; a dormant engine is skipped), and a commit in the protocol clone (English message, no push).

## Takes / does not take

- **Takes:** «in `kit.md` require choosing template or custom for a new extension file and logging the choice in History; same text in the protocol copy»; «in a skill, take template tooling from `template/`, delete the lines about the old layer list».
- **Does not take:** «draft prose with no repository files or commits» (→ `run-text`); «change `extensions.cjs` or `engine-to-protocol.cjs`, sort files» (→ `run-protocol-engine`); «edit a Node script» (→ `run-protocol-script`); «write wording into the site» (→ `run-site-php`).

## Boundary

Edit only the files the kit names, and only the passages the criterion names; no code, no scripts. Each project/protocol pair must end byte-identical (`cmp`); a mismatch is reported, not tolerated. Protocol files carry no project traces (prohibition 16). Commit only in `.forma/protocol` on `dev` (check the branch first), English message with no Cyrillic (prohibition 18), never push. Quote the last line of the engine check (`sync-engines --check`; a dormant engine is skipped) and each `cmp` result. A conflict reported by `engine-to-protocol.cjs` is a stop, return to `Kit`. A second identical diagnosis (prohibition 14) is a stop.
