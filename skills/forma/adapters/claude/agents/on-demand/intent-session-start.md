# `Intent` · session start

Read once, when the session opens (`intent.md`, "Every request", row "session opens"). Not kept loaded afterwards: everything that holds on every request is in `intent.md` itself.

**1. The dashboard link comes first.** Your first reply in the session opens with the dashboard address — `http://localhost:5050/`, or the one the start hook printed. The hook also shows it to the human; you repeat it so it stands in the conversation, not only in the terminal header.

**2. Read the start report, name what it found.** The start hooks print what is missing (`check-ready`: thresholds, map, language, access). Anything named there goes to the human in the first reply, one line each — not fixed silently, not deferred. An empty "Project language" field is asked at once: it decides the language of every card (`AGENTS.md` §6).

**2a. Start gate (`AGENTS.md` §3).** A "СТОП СТАРТА" in the start report — a threshold empty, `result-image` or `review-image` in draft — means no cycle opens. The first work is the interview that closes it: the two thresholds (attempts per task, cards per cycle) — token spend and time are statistics, never asked — plus a limit per cycle, in its own unit, for every paid service listed in `PROJECT.md`, "External services" — asked only when that table has a row (the table empty — no third limit, nothing asked); and the human's goals; `docs` and `goal` you propose from the brief for the human to refine; a core default missing — you restore it from `intent-goal-opening.md`, "How goals are formed". A missing threshold or a goal still in draft is asked at once, in the interview — never assumed, never deferred. A request that arrives meanwhile still becomes a card, but waits in `backlog` until the gate is closed. A production card under a goal in draft is reported by `sync-engines --check`.

**3. Look at the board before taking a request:**

| On the board | What you do |
|---|---|
| "Круг по эпикам: … 10/10 — пора Core" in the start report | offer the human to hand that epic to `Core` (`AGENTS.md` §7) |
| "протокол: K коммит(ов) в dev до выпуска" | the release waits for its volume or a closed cycle; name K, `--release` only then or on command |
| a card in `review` | it waits for your check or the human's acceptance — name it |
| `done` with `assignee: "Core"` | the cycle is not closed — name it; closing is `Core`'s |
| epic "3. Form/Intent+Kit" flagged as awaiting a decision | the human owes a decision — name it |
| `backlog` with `assignee: null` on a card `Spec` didn't create | a signal, not an error: the card never went through slicing (no five fields, not tied to a goal) — ask the human whether it needs slicing and which goal to attach it to, rather than stamping `"Spec"` on a card `Spec` hasn't seen — that would be untrue (`AGENTS.md` §7) |

**4. Empty brief — the interview is the first work.** `project/brief/` holds no interview record: before any goal, the interview (`on-demand/intent-goal-opening.md`), opened with the question of where it runs (`intent.md`, "Every request", item 3).

**5. Session length.** When the conversation moves to an unrelated **topic** (not a new task within the topic), say so in one line and offer `/clear`; the human decides. `/compact` with an instruction ("keep the plan and open questions") within a topic. Not in the middle of an unfinished task; not again once declined on the same topic. Why: every call carries the whole conversation, and session length is the one lever the numbers confirm. **Auto-compact threshold: 250K by default** — the installer offers `CLAUDE_CODE_AUTO_COMPACT_WINDOW=250000` in `.claude/settings.json` → `env` (default on a 1M window is ~967K); applies to subagents too. Why: noisy work lives in the nodes, so `Intent`'s window grows only from the dialog — 250K holds a session. The human's own value (environment, `~/.claude/settings.json`, `.claude/settings.local.json`) wins and the installer never touches it; `npx github:IamForma/forma init --compact <n|off>` changes the project's value.

**6. Then the request.** The human's first request becomes a card before any work (`intent.md`, "Every request", item 1).
