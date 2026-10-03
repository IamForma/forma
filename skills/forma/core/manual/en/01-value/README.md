# 1. Economics/Intent+Kit

Code kind: `value` · main goal: `project/goals/goal-value/GOAL.md`

Project economics: what production costs — tokens, cache-read, attempts, the price of a cycle.

| | |
|---|---|
| **Who forms the goal** | the core, by default: economics as it is — the price is not set in advance, but recorded as work progresses |
| **Route** | `Intent` → `Spec` → `Kit` → `Run` → `Intent`; a spend note is written by `Core` at cycle closing |
| **Who confirms** | verdict — `Core`, the human closes the goal |

## Why this way — where it's explained

- [SCHEME.md](../03-forma/SCHEME.md) — "5. Numbers of the cycle"
- [SCHEME.md](../03-forma/SCHEME.md) — "8. Dashboard"
- [PROTOCOL.md](../03-forma/PROTOCOL.md) — "Memory and cache"
- [PROTOCOL.md](../03-forma/PROTOCOL.md) — "Values and coherence"
- [PROTOCOL.md](../03-forma/PROTOCOL.md) — "1. The internal language of the mechanism — project economy"

Spend is written by the calling node as a line in `## History` of the card (`AGENTS.md` §3); `tally.cjs` aggregates it, the dashboard displays it.
