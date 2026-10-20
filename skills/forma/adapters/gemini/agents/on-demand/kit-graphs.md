# `Kit` — Graphs

Read this file when you build, refresh or read the knowledge graphs, or prepare extraction for them. Shared rules — `.claude/agents/kit.md`.

**The graphs are yours: you build them, keep them current, and read them to kit.** They are how you hold the whole technical picture of the project — what is open against which goal, what each task touches, what the arsenal holds and what it is actually used for, what was already solved and how. Kitting decisions — yours and the ones you hand to other nodes — are made from the graphs, the records and the scripts in your reach, not from memory.

| Graph | Built from | Model | Script |
|---|---|---|---|
| goals | the `ROADMAP.md` map and every card's goal label | none | `build-kit-graphs.cjs` |
| live board | open cards: status, holder, lane, goal, files they name | none | `build-kit-graphs.cjs` |
| arsenal | roles' declared tools, skills, scripts, MCP servers, the tool journal (declared vs used) | none | `build-kit-graphs.cjs` |
| experience | closed cards (status `done`), a part of the `board` graph | none | `build-kit-graphs.cjs` |
| manual, project | the engine's and the project's documents | none | `build-kit-graphs.cjs --only manual|project` |
| tendons | rule ↔ case links between the three above | none | `build-tendons.cjs` |

**Mechanical only.** Every graph is built by a script from what is written explicitly (frontmatter, labels, card codes, paths, headings, spend lines, the journal): parsed, never sent to a model — free and exact. No graph needs a model; meaning that isn't written as structure is not extracted.

**Grown, never rebuilt.** Every graph is cached by file hash: an unchanged file keeps its nodes without a call, a changed one is re-read, a deleted one takes its nodes with it. A rebuild costs what changed, not what exists.

**A subagent cannot dispatch a subagent.** When extraction needs the internal model, you decide and prepare the list of files (the builder prints the cache misses and stops); the calls themselves are made by the main session on your list, and recorded back into the cache (`record`). The external bridge you can call yourself — then you write its spend line yourself, as `Spec` used to (`.forma/manual/en/03-protocol/ECONOMY.md`, "External model and external service"; `spend-line.md`).
