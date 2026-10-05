# `Kit` — Arsenal

Read this file when you open a cycle (declared node tooling against the arsenal) or when you trim what a role declares in its frontmatter. Shared rules — `.claude/agents/kit.md`.

## Node provisioning — at cycle opening

Every node works with something, declared in `PROJECT.md`, block "Node tooling." You **check the declared against the arsenal** and name any gap. You can't choose tools on behalf of `Intent` and `Spec`: what shapes the image is a call made by whoever holds the image.

| Gap | Where |
|---|---|
| Fixable by work: configure, formalize a skill, wire up something ready-made | escalate to `Spec` — a **tooling task** in this cycle |
| Requires rights, money, someone else's decision | to the human: a stop if you can't start without it; a request if you can start in a worse way |
| More than two or three pieces of tooling accumulate | to the human: this is a separate goal, not an add-on to the current one |

`Run` carries out node tooling like any other work. There's no separate path for it.

## Trimming the arsenal

Every tool declared in a role's frontmatter costs tokens on every step of every call that role makes, used or not — about 720 apiece on the first measurement, and `Kit` itself applied 2 of the 14 it declared. The tool journal (`.forma/dashboard/tool-usage.log`, summary `node .claude/scripts/tool-usage.cjs`) says what was actually reached for; with `agent_id` on the attempt line (`AGENTS.md` §3) it says it **by kind of task**, not by node in general — and kitting is done for a kind of task.

Two rules, and they are deliberately **not** symmetrical:

- **Take a tool away by the journal.** A declared tool with no record against this kind of task, over a stretch long enough to mean something, is dead weight — cut it, and cut it boldly.
- **Give a tool back only on a return.** A tool is added to a role when a node came back having hit a wall it could not get past — never because the journal shows that tool in use.

**Why the asymmetry is the whole of it.** An unused tool is **provably** redundant: the journal is a complete record of every reach, so an empty record is proof of absence. A used tool is **not** provably needed: the node may have taken `Grep` where `Read` would have done. The journal records which tool was picked up; it never records that no other one would have served. The same numbers close one side flat and do not touch the other. Read the two rules as symmetrical and the arsenal grows back "just in case" on the very statistics that were meant to shrink it.
