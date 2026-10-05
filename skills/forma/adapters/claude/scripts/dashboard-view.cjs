'use strict';

/**
 * Что дашборд показывает о Claude Code: настройки, MCP-конфиги, каталог стенограмм.
 * Читается адаптером (`.claude/forma-adapter.cjs`); ядро само этих путей не знает.
 * ТОЛЬКО ЧТЕНИЕ. Запрет 15: из `~/.claude.json` и `.mcp.json` — только имена серверов;
 * из `env` — значения, кроме переменных, чьё имя похоже на секрет (у них только имя).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { readJson } = require('../../.forma/dashboard/lib/fs.cjs');
const { parseFrontmatter } = require('../../.forma/dashboard/lib/card.cjs');

const SECRET = /KEY|TOKEN|SECRET|PASSWORD|AUTH|CREDENTIAL/i;
const SYNC_SCRIPT = path.join('.claude', 'scripts', 'sync-engines.cjs');

/** Файлы MCP-серверов по уровням: проектные ездят с репозиторием, пользовательский — с человеком. */
function mcpConfigs(root) {
  return [
    { rel: '.mcp.json', file: path.join(root, '.mcp.json'), level: 'проект' },
    { rel: '.claude/.mcp.json', file: path.join(root, '.claude', '.mcp.json'), level: 'проект' },
    { rel: '~/.claude.json', file: path.join(os.homedir(), '.claude.json'), level: 'пользователь' },
  ];
}

/** Каталог стенограмм проекта. Слаг движок строит из пути: всё, что не буква и не цифра, — дефис.
 *  Правило не документировано, поэтому есть отход — поиск без учёта регистра среди существующих. */
function transcriptsDir(root) {
  const base = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(base)) return null;
  const encoded = root.replace(/[^A-Za-z0-9]/g, '-');
  for (const c of [encoded, encoded.charAt(0).toLowerCase() + encoded.slice(1)]) {
    const p = path.join(base, c);
    if (fs.existsSync(p)) return p;
  }
  const want = encoded.toLowerCase();
  const found = fs.readdirSync(base).find((d) => d.toLowerCase() === want);
  return found ? path.join(base, found) : null;
}

const subdirs = (dir) => (fs.existsSync(dir)
  ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : []);

function readEnv(st) {
  if (!st || !st.env) return [];
  return Object.keys(st.env).map((k) => ({ name: k, value: SECRET.test(k) ? null : String(st.env[k]), hidden: SECRET.test(k) }));
}

function readHooks(st) {
  const hooks = [];
  if (!st || !st.hooks) return hooks;
  for (const [event, groups] of Object.entries(st.hooks)) {
    for (const g of groups || []) {
      hooks.push({ event, matcher: g.matcher || '', commands: (g.hooks || []).map((h) => String(h.command || '').replace(/^bash\s+/, '')) });
    }
  }
  return hooks;
}

function readNodes(agentsDir) {
  if (!fs.existsSync(agentsDir)) return [];
  return fs.readdirSync(agentsDir).filter((x) => x.endsWith('.md')).sort().map((f) => {
    const fm = parseFrontmatter(fs.readFileSync(path.join(agentsDir, f), 'utf8'));
    const tools = String(fm.tools || '').split(/,\s*(?![^()]*\))/).map((s) => s.trim()).filter(Boolean);
    return { name: fm.name || f.replace(/\.md$/, ''), file: '.claude/agents/' + f, model: fm.model || null, effort: fm.effort || null, tools };
  });
}

function readMcpNames(root) {
  const names = (f) => { const j = readJson(f); return j && j.mcpServers ? Object.keys(j.mcpServers) : null; };
  const project = ['.mcp.json', '.claude/.mcp.json'].map((p) => ({ file: p, servers: names(path.join(root, p)) }));
  const uj = readJson(path.join(os.homedir(), '.claude.json'));
  const user = uj && uj.mcpServers ? Object.keys(uj.mcpServers) : [];
  let userProject = [];
  if (uj && uj.projects) {
    const norm = (s) => path.resolve(s).toLowerCase();
    for (const [k, v] of Object.entries(uj.projects)) {
      if (norm(k) === norm(root) && v && v.mcpServers) userProject = Object.keys(v.mcpServers);
    }
  }
  return { project, user, userProject };
}

/** Строки причин из вывода сверки: пункты `✗` с подпунктами и строки таблицы, не отмеченные `✓`. */
function syncReasons(out) {
  const lines = out.split(/\r?\n/);
  const reasons = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/✗/.test(l) && !/^\|/.test(l)) {
      const sub = [];
      for (let j = i + 1; j < lines.length && /^\s{3,}—/.test(lines[j]); j++) sub.push(lines[j].replace(/^\s*—\s*/, '').trim());
      reasons.push(l.trim() + (sub.length ? ': ' + sub.join('; ') : ''));
    } else if (/^\|/.test(l) && !/✓|Статус|---/.test(l)) {
      const c = l.split('|').map((s) => s.trim()).filter(Boolean);
      reasons.push(c[0] + ' — ' + c[c.length - 1]);
    }
  }
  return reasons;
}

/** Индикатор сверки: реальный код выхода `sync-engines --check` при каждой сборке. */
function runSyncCheck(root) {
  const script = path.join(root, SYNC_SCRIPT);
  if (!fs.existsSync(script)) return { ran: false };
  const r = spawnSync(process.execPath, [script, '--check'], { cwd: root, encoding: 'utf8', timeout: 30000 });
  const out = String(r.stdout || '') + String(r.stderr || '');
  return { ran: true, exitCode: r.status, ok: r.status === 0, reasons: syncReasons(out), command: 'node .claude/scripts/sync-engines.cjs --check' };
}

/**
 * Находит исполняемый файл `claude` в PATH процесса. На Windows `spawnSync('claude', …)` без
 * `shell: true` не резолвит npm-шим (`claude.cmd`) — CreateProcess не читает PATHEXT сам, это
 * делает только cmd.exe. Поэтому ищем явный путь с расширением один раз при старте (кэш ниже),
 * а не на каждый вызов — «явный путь при старте», не поиск по месту.
 */
function findExecutable(name) {
  const isWin = process.platform === 'win32';
  const dirs = String(process.env.PATH || process.env.Path || '').split(path.delimiter).filter(Boolean);
  const exts = isWin ? String(process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';') : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext.toLowerCase());
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch { /* нет файла — пробуем дальше */ }
    }
  }
  return null;
}

const CLAUDE_BIN = findExecutable('claude');

/** Плагины движка: `claude plugin list --json` — id/scope/enabled, без значений секретов (запрет 15). */
function readPlugins(root) {
  if (!CLAUDE_BIN) {
    return { ran: false, list: [], reason: 'команда `claude` не найдена в PATH процесса дашборда' };
  }
  const r = spawnSync(CLAUDE_BIN, ['plugin', 'list', '--json'], { cwd: root, encoding: 'utf8', timeout: 15000 });
  if (r.error) return { ran: false, list: [], reason: 'ошибка запуска: ' + r.error.message };
  if (r.status !== 0) {
    return { ran: false, list: [], reason: 'claude plugin list --json завершился с кодом ' + r.status };
  }
  let arr;
  try { arr = JSON.parse(r.stdout); } catch { return { ran: false, list: [], reason: 'ответ не разобрался как JSON' }; }
  if (!Array.isArray(arr)) return { ran: false, list: [], reason: 'ответ не JSON-массив' };
  return { ran: true, list: arr.map((p) => ({ id: p.id, scope: p.scope, enabled: !!p.enabled })) };
}

/** Вкладка «Движок»: настройки Claude Code, роли узлов, MCP, скиллы, сверка. */
function engineSettings(root) {
  const st = readJson(path.join(root, '.claude', 'settings.json'));
  return {
    present: !!st,
    env: readEnv(st),
    hooks: readHooks(st),
    nodes: readNodes(path.join(root, '.claude', 'agents')),
    skills: subdirs(path.join(root, '.claude', 'skills')).sort(),
    mcp: readMcpNames(root),
    check: runSyncCheck(root),
    plugins: readPlugins(root),
  };
}

module.exports = { mcpConfigs, transcriptsDir, engineSettings };
