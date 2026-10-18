# Журнал протокола «Форма»

Что изменилось на уровне Движка (`AGENTS.md`, `manual/`, `.claude/agents/`) и что каждое изменение чинит. Запись держит дату решения; новые — сверху.
- **0.0.2** — **Project extensions: the project's own work is separate from the engine.**
  **What was done.** `project/extensions/<engine>/` (`claude`, `codex`, `agents`) is the source of truth for the project's own roles, skills, scripts and hooks; `.forma/extensions/extensions.cjs` copies them into the engine folders (the project wins on a name clash, a hand-edited copy is kept), on install and by a Claude hook after a write; `npx github:IamForma/forma extensions [--check]`. `uninstall` lists the files of `.claude/` that are not part of the release and moves them to `project/extensions/` before removing the engine. Rules of `Intent`, `Kit`, `AGENTS.md` §6 and the manual say where new work is written.
  **What is left.** Only `.claude/` is scanned by `uninstall` for foreign files (Codex and Gemini folders hold generated mirrors); Codex and Gemini sync on install and by command, without a hook.
- **0.0.1** — **First release.**
  **What was done.** The five-node protocol with the Claude Code, Codex and Gemini adapters, the board, the dashboard, the manual, the installer (`init`, `uninstall`) and the `forma-wordpress-novamira` template.
  **What is left.** Codex and Gemini adapters are beta.
