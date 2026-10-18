# 1. Project analytics

Code kind: `analytics` · main goal: `project/goals/goal-analytics/GOAL.md`

Statistics of spend and token movement over time; every resource that is counted; tasks about the project's economy. Spend lines and the "Economy" dashboard stay with `Intent` and `Core`. Later, statistics on how effective experience was — reached or not reached — will come here.

| | |
|---|---|
| **Who forms the goal** | the core, by default: economics as it is — the price is not set in advance, but recorded as work progresses |
| **Route** | each task's route is named by its `route-N` label; `Core` writes the spend remark when a cycle closes |
| **Who confirms** | verdict — `Core`, the human closes the goal |

## Why this way — where it's explained

- [SCHEME.md](../03-protocol/SCHEME.md) — "5. Numbers of the cycle"
- [SCHEME.md](../03-protocol/SCHEME.md) — "8. Dashboard"
- [PROTOCOL.md](../03-protocol/PROTOCOL.md) — "Memory and cache"
- [PROTOCOL.md](../03-protocol/PROTOCOL.md) — "Values and coherence"
- [PROTOCOL.md](../03-protocol/PROTOCOL.md) — "1. The internal language of the mechanism — project economy"

Spend is written by the calling node as a line in `## History` of the card (`AGENTS.md` §3); `tally.cjs` aggregates it, the dashboard displays it.
