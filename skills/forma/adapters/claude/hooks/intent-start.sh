#!/bin/sh
# SessionStart: основная сессия — Intent (AGENTS.md §1, §8 .claude/rules/claude-8.md).
# Подаёт в контекст роль intent.md и on-demand intent-session-start.md,
# показывает человеку ссылку на дашборд (systemMessage). Никогда не блокирует: exit 0.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
command -v node >/dev/null 2>&1 || exit 0
node -e '
const fs = require("fs");
const read = p => { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } };
const role = read(".claude/agents/intent.md").replace(/^---[\s\S]*?---\n/, "");
const start = read(".claude/agents/on-demand/intent-session-start.md");
const port = (() => { try { return require(process.cwd() + "/.forma/dashboard/port.cjs").DEFAULT_PORT; } catch { return 5050; } })();
const url = "http://localhost:" + port + "/";
const ctx = "Основная сессия — Intent (AGENTS.md §1). Роль и правила старта ниже; первый ответ начинается со ссылки на дашборд " + url + ".\n\n" + role + "\n\n" + start;
process.stdout.write(JSON.stringify({
  systemMessage: "Дашборд Формы: " + url,
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ctx }
}));
'
exit 0
