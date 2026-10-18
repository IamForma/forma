# project/extensions/

What this project builds on top of the protocol: roles, skills, scripts and hooks of its own. It is the source of truth and survives `forma uninstall` and any reinstall; the protocol itself stays as released.

```
extensions/claude/   -> .claude/    (agents/run/*.md, scripts/, skills/, hooks/)
extensions/codex/    -> .codex/
extensions/agents/   -> .agents/
```

- Write new work here, not into `.claude/`. The folders of the engine hold copies, made by `node .forma/extensions/extensions.cjs` (on install, and by the hook after a write here).
- A file here with the same name as an engine file replaces it; the sync prints `override`. Delete the file here and reinstall to get the default back.
- A copy edited by hand is kept and reported as `drift`; move the edit here.
- To make something part of the protocol itself, move it to the protocol source (`engine-to-protocol.cjs`) and release it.
