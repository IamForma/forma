#!/usr/bin/env node
// Хуки Codex, общие для PowerShell-обёрток (.codex/hooks/*.ps1). Никогда не блокируют: exit 0.
//   intent-start — SessionStart: основная сессия = Intent (AGENTS.md §1): роль и старт в контекст, ссылка на дашборд.
//   check-card   — PostToolUse (apply_patch): карточка доски проверяется sync-engines --check в момент записи.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const read = p => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return ''; } };
const out = o => process.stdout.write(JSON.stringify(o));

// Стоп старта (AGENTS.md §3): цели человека не в черновике, четыре порога заданы.
function startGate() {
  const stop = [];
  for (const c of ['result-image', 'review-image']) {
    const g = read(`project/goals/goal-${c}/GOAL.md`);
    if (!g || /^draft:\s*true\s*$/m.test(g)) stop.push(`goal-${c}: образ цели не сформирован человеком (draft)`);
  }
  const block = (read('project/PROJECT.md').match(/^\| Порог[\s\S]*?(?:\r?\n\s*\r?\n|(?![\s\S]))/m) || [''])[0];
  if (/^\| [^|]+ \| *(не задан)? *\|\s*$/m.test(block)) stop.push('PROJECT.md: заданы не все четыре порога');
  const svc = (read('project/PROJECT.md').match(/^\| Сервис \|[\s\S]*?(?:\r?\n\s*\r?\n|(?![\s\S]))/m) || [''])[0];
  if (svc.split(/\r?\n/).slice(2).some(l => /^\|.*\| *\|\s*$/.test(l))) stop.push('PROJECT.md: у платного сервиса не задан предел на круг');
  return stop.length ? 'СТОП СТАРТА — круг не открывается, сначала интервью с человеком (AGENTS.md §3):\n' + stop.map(s => '  · ' + s).join('\n') + '\n\n' : '';
}

function intentStart() {
  const url = 'http://localhost:5050/';
  // The Codex adapters only point at the authority.  Injecting them here used to
  // omit the actual Intent body and start procedure from the main session.
  const role = read('.claude/agents/intent.md').replace(/^---[\s\S]*?---\s*/, '');
  const start = read('.claude/agents/on-demand/intent-session-start.md').replace(/^---[\s\S]*?---\s*/, '');
  let cycle = '';
  try { cycle = execFileSync(process.execPath, [path.join(ROOT, '.claude', 'scripts', 'cycle-status.cjs')], { cwd: ROOT, encoding: 'utf8' }); } catch {}
  const ctx = startGate() + (cycle ? cycle + '\n' : '') + 'Основная сессия — Intent (AGENTS.md §1). Роль и правила старта ниже; первый ответ начинается со ссылки на дашборд ' + url + '.\n\n' + role + '\n\n' + start;
  out({ systemMessage: 'Дашборд Формы: ' + url, hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx } });
}

function checkCard() {
  let input = '';
  try { input = fs.readFileSync(0, 'utf8'); } catch { return; }
  let j; try { j = JSON.parse(input); } catch { return; }
  const ti = j.tool_input || {};
  // apply_patch несёт пути внутри текста патча; прочие инструменты — в file_path/path.
  const text = [ti.command, ti.patch, ti.input, ti.file_path, ti.path].filter(x => typeof x === 'string').join('\n');
  const ids = [...new Set([...text.matchAll(/\.devtool[\/\\]features[\/\\](?:done[\/\\])?(card-[^\s\/\\]+?)\.md/g)].map(m => m[1]))];
  if (!ids.length) return;
  const script = path.join(ROOT, '.claude', 'scripts', 'sync-engines.cjs');
  if (!fs.existsSync(script)) return;
  let report = '';
  try { report = execFileSync(process.execPath, [script, '--check'], { cwd: ROOT, encoding: 'utf8' }); }
  catch (e) { report = (e.stdout || '') + (e.stderr || ''); }
  const problems = report.split('\n').filter(l => ids.some(id => l.includes(id)) && !/^\s*ok:/.test(l)).join('\n');
  if (!problems) return;
  out({
    systemMessage: 'Карточка не прошла проверку доски:\n' + problems,
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 'Карточка не прошла проверку доски (sync-engines --check), исправь сейчас:\n' + problems }
  });
}

try { ({ 'intent-start': intentStart, 'check-card': checkCard })[process.argv[2]]?.(); } catch {}
process.exit(0);
// Шаблон протокола: .forma/protocol/skills/forma/templates-codex/.codex/scripts/codex-hooks.cjs — переносит forma-commit.cjs.
