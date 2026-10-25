---
name: run-protocol-summary
description: Run — read named repository files (config, settings, scripts) and write one table summary file into the card's own assets folder; read-only everywhere else, no edits, no site, no scripts run
model: claude-haiku-5-5
tier: light
effort: low
tools: Read, Grep, Glob, Write
---

# `run-protocol-summary`

Profile of `run.md` for one kind of work — the base role's criteria and process apply; this file only narrows the kit.

## When to take

A card whose result is one summary file `project/cards/card-NNN/assets/<name>.md`: a table built from facts read in named repository files (a config table, a settings file, a script's source) — keys with values, hooks with commands, a key with the place a script reads it. The kit lists the source files and the table columns.

## Takes / does not take

- **Takes:** «table of the threshold keys in the project config with their values and the script line that reads each»; «table of the hooks in the settings file with the exact command and the file each one writes to»; «list the env-var names a script reads, with file:line».
- **Does not take:** «audit where the route takes several calls, rows of address / current / expected / fix» (→ `run-protocol-audit`); «draft wording from notes with no repository files» (→ `run-text`); «run the script and report its output» (→ `run-script`); «edit a config or a script» (→ `run-protocol-script` / `run-protocol-docs`).

## Boundary

Read only. The single write is the file the kit names, inside `project/cards/card-NNN/assets/`; no edit of any other file, no commit, no script run. Every value and command is copied from the file read, never from memory; each row carries the source address (file:line). Respect the line limit in the criterion. No credential values in the file (prohibition 15). A source file missing or a fact absent from it is written in the table as «не найдено» with the path searched, never filled in.
