#!/bin/sh
# SessionStart: the main session is Intent (AGENTS.md §1, §8 in .claude/rules/claude-8.md).
# Feeds the role intent.md and the on-demand intent-session-start.md into the context and shows the human the
# dashboard link (systemMessage), in the project language (.forma/i18n). Never blocks: exit 0.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
command -v node >/dev/null 2>&1 || exit 0
node -e '
const fs = require("fs");
const read = p => { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } };
const role = read(".claude/agents/intent.md").replace(/^---[\s\S]*?---\n/, "");
const start = read(".claude/agents/on-demand/intent-session-start.md");
// the dashboard port is dynamic: the live server writes it to server.json; the default only if there is no file
const port = (() => {
  try { const p = Number(JSON.parse(read(".forma/dashboard/.cache/server.json")).port); if (p > 0) return p; } catch { /* no server yet */ }
  try { return require(process.cwd() + "/.forma/dashboard/port.cjs").DEFAULT_PORT; } catch { return 5050; }
})();
const url = "http://localhost:" + port + "/";
let text = (code, params) => code;
try {
  const i18n = require(process.cwd() + "/.forma/i18n/index.cjs");
  const lang = i18n.projectLang(process.cwd());
  text = (code, params) => i18n.message(code, params, lang);
} catch { /* no catalog: the codes themselves are shown */ }
const ctx = text("hook.intent_context", { url }) + "\n\n" + role + "\n\n" + start;
process.stdout.write(JSON.stringify({
  systemMessage: text("hook.dashboard_link", { url }),
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ctx }
}));
'
exit 0
