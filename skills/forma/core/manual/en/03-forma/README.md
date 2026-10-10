# 3. Form/Intent+Kit

Kind code: `forma` · main goal: `project/goals/goal-forma/GOAL.md`

The engine and mechanics of the task: the five nodes, kitting, execution, form check, return, handoff, the schema language.

| | |
|---|---|
| **Who forms the goal** | the core, by default: an engine assembled from whatever is available — fine-tuned along the way |
| **Route** | short route `Intent` → the human → `Kit` → `Intent`: the human approves the five fields of the card instead of `Spec` (`AGENTS.md` §2) |
| **Who confirms** | `Intent` or the human; `Intent`'s work — only the human |

Complete reference documents of the engine live here — they are not divided into sections:

| File | About |
|---|---|
| [PROTOCOL.md](PROTOCOL.md) | structure and rationale: the five pairs, the loss ladder, return, prohibitions, the schema language, the emotional compass |
| [SCHEME.md](SCHEME.md) | composition, environment requirements, cycle cache, cycles, who talks to the human, dashboard, reading levels |
| [KITTING.md](KITTING.md) | kitting of the project at deployment |
| [ZONES.md](ZONES.md) | zones of the protocol constructor |
| [LEVERS.md](LEVERS.md) | register of levers that raise efficiency and the leaks they close |
| [SKILLS.md](SKILLS.md) | skills of the nodes as skills of the environment |
| [five-nodes.md](five-nodes.md) | the route of the five nodes, diagram |
| [ROUTES.md](ROUTES.md) | route choice for a task: `route-0`…`route-8`, overlays `over-1`…`over-4`, the choice rule, waves at scale |
| [LOCALIZATION.md](LOCALIZATION.md) | dashboard localization: two languages, dictionaries, the `locale-parity` check |
| [PROTOCOL-DEVELOPMENT.md](PROTOCOL-DEVELOPMENT.md) | developing the protocol from a project: clone, engine alignment, transfer, trace check, push |

## Demo cycle

A fresh project (start gate closed, empty board) gets one offer in the first session: a short demonstration of the whole route on two small cards. The human answers **start**, **skip** or **later**; the answer is kept in `project/config/DEMO` (`none`, `declined`, `later:<n>`, `done`), so it is asked once. The demo cards carry the label `demo`: they are the only cards allowed under a closed gate, they stay out of the dashboard's spend and statistics, and the demo ends with a node-by-node table (attempts, tokens, time) and a clean-up — remove or keep. Procedure: `intent-demo.md`.
