'use strict';

/**
 * Журнал инструментов движка MiniMax: объявленный арсенал роли (фронтматтер) и запись хука.
 *
 * Формат журнала — общий с остальными движками (`ts · узел · agent_id · инструмент · путь`),
 * файл журнала — общий с ядром: `.forma/dashboard/tool-usage.log`. Пишет его хук плагина
 * этого движка; пока плагин не установлен, журнала нет — и это поломка, а не тишина:
 * `alive: false` означает «хук не отработал ни разу».
 */

const fs = require('fs');
const path = require('path');

const LOG = path.join('.forma', 'dashboard', 'tool-usage.log');
const HOOK_ERROR = ['!ERROR', '!ОШИБКА'];

/** Голое имя инструмента: `Bash(node x *)` → `Bash`. */
function baseName(decl) {
  const i = String(decl).indexOf('(');
  return (i === -1 ? String(decl) : String(decl).slice(0, i)).trim();
}

/** Разбор списка через запятую с оглядкой на скобки: `Bash(node x, y)` — один элемент. */
function splitTools(line) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of String(line)) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Объявленный арсенал ролей: имя роли → { file, decls }. Только из фронтматтера, не из памяти. */
function readDeclared(agentsDir) {
  const roles = new Map();
  let entries = [];
  try {
    entries = fs.readdirSync(agentsDir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.md'));
  } catch {
    return roles;
  }
  for (const e of entries) {
    const file = path.join(agentsDir, e.name);
    const text = fs.readFileSync(file, 'utf8');
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) continue;
    const toolsLine = (fm[1].match(/^tools:.*$/m) || [''])[0].replace(/^tools:\s*/, '').trim();
    if (!toolsLine) continue;
    const name = (fm[1].match(/^name:\s*(.+)$/m) || [null, path.basename(e.name, '.md')])[1].trim();
    roles.set(name, { file: e.name, decls: splitTools(toolsLine) });
  }
  return roles;
}

/** Разбор журнала. Нет файла — хук не отработал ни разу. */
function readLog(logFile = LOG) {
  if (!fs.existsSync(logFile)) return { alive: false, rows: [], errors: [] };
  const lines = fs.readFileSync(logFile, 'utf8').split(/\r?\n/);
  const rows = [];
  const errors = [];
  for (const line of lines) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const parts = s.split('·').map((p) => p.trim());
    if (parts.length < 4) {
      errors.push({ ts: '?', reason: `строка не разобрана: ${s}` });
      continue;
    }
    const [ts, node, agentId, tool, file] = parts;
    if (HOOK_ERROR.includes(node)) errors.push({ ts, reason: tool });
    else rows.push({ ts, node, agentId, tool, file: file || null });
  }
  return { alive: true, rows, errors };
}

module.exports = { baseName, splitTools, readDeclared, readLog, LOG };
