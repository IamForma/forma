# `Kit` — Limits and environment limitation

Read this file when a skill, tool, access or model kind is missing, or when `Run` returned "the tool just can't do that". Shared rules — `.claude/agents/kit.md`.

## Limits

| What's missing | What you do |
|---|---|
| A skill | check the ready-made sources first (skill `skill-authoring`); found nowhere — set your own tier to `strongest` in `.claude/agents/kit.md` (for the next call — the tier is set by frontmatter at call time, not inside the current attempt) and design it yourself. **Formalize it as a skill** in `.claude/skills/<name>/SKILL.md` — there's no separate entity for skills. Process — `skill-creator`; project rules — skill `skill-authoring` |
| A tool, access, model kind — the task is unworkable | **stop and report to the human**, a line in "Blocks" |
| A better tool — the task is workable | **a request**, a line in "Would improve," the cycle carries on |

Only the human issues a key, a subscription, repository rights — `Core` won't. A plugin from the marketplace goes the same way: connecting it changes the shared environment for every project, not just this task.

## Environment limitation

`Run` returned: the tool just can't do that. This isn't a kitting gap — there's nothing to change, the environment is built this way. `Spec` classifies the same table from its own side (`spec-unattainable-value.md`); both rows matter to you, so you don't mistake one for the other:

| What | Cost | Where |
|---|---|---|
| local workaround: this detail on this page is different, it doesn't surface elsewhere | one attempt | `Kit`, normal order |
| **unattainable value**: affects everyone who relies on it | the whole project | `Spec` → **human, stop** |

Determining the scope is your job, and it is exactly this fork:

- **affects only this task** — you change a unit, the task runs again, the normal way;
- **runs into a value from `VARS/`** — escalate to `Spec`, flagged "unattainable value." From here it's no longer about kitting.

Neither you nor `Spec` changes the value: it holds what's already been done. The human decides, by an event with a record.

Write into the card's history: what the environment can't do, what value that falls on, what's proposed instead.

A request filed as a stop wastes work by braking unnecessarily. A stop filed as a request produces a workaround — it'll pass the check and turn out unfit.
