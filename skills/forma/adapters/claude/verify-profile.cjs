'use strict';

// Профиль сверки установки для Claude Code: проводка адаптера (хуки, роли, ссылки) и поведение стартовых проверок.
// Ядро (`.forma/verify/verify-install.cjs`) находит этот файл по описи (`engines[].profile`) и вызывает `check(ctx)`.
// Ожидания берутся из описи (`engine.expect`), а не из кода: установщик записал, что поставил — профиль сверяет это с диском.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const walkFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walkFiles(p) : [p];
  });
};

/** Проводка хуков: каждый ожидаемый хук — файл есть, в settings.json стоит команда в своей группе события. */
function checkHooks(ctx, expect, out) {
  const { root, finding } = ctx;
  const settingsFile = path.join(root, '.claude', 'settings.json');
  if (!fs.existsSync(settingsFile)) { out.push(finding('.claude/settings.json', 'настройки Claude Code с хуками', 'нет файла')); return; }
  let settings;
  try { settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8')); }
  catch (e) { out.push(finding('.claude/settings.json', 'корректный JSON', e.message)); return; }
  for (const h of expect.hooks || []) {
    const file = `.claude/hooks/${h.name}`;
    if (!fs.existsSync(path.join(root, file))) out.push(finding(file, `хук ${h.event}${h.matcher ? ' [' + h.matcher + ']' : ''}`, 'нет файла'));
    const groups = (settings.hooks && settings.hooks[h.event]) || [];
    const group = groups.find((g) => (g.matcher || '') === (h.matcher || ''));
    const entry = group && (group.hooks || []).find((x) => x.command === `bash ${file}`);
    const addr = `.claude/settings.json → hooks.${h.event}${h.matcher ? '[' + h.matcher + ']' : ''}`;
    if (!entry) out.push(finding(addr, `команда «bash ${file}»`, group ? 'команды в группе нет' : 'группы события нет'));
    else if (h.timeout && entry.timeout !== h.timeout) out.push(finding(addr + ' → ' + h.name + ' → timeout', String(h.timeout), String(entry.timeout)));
  }
  for (const f of walkFiles(path.join(root, '.claude', 'hooks')).filter((x) => x.endsWith('.sh'))) {
    const r = spawnSync('bash', ['-n', f], { encoding: 'utf8' });
    if (r.error) { out.push(finding('bash', 'bash доступен для проверки хуков', r.error.message)); break; }
    if (r.status !== 0) out.push(finding(path.relative(root, f).split(path.sep).join('/'), 'bash -n: синтаксис хука', (r.stderr || '').trim().split('\n')[0]));
  }
}

/** Роли: пять узлов на месте, в `tools:` нет плейсхолдеров `mcp__<…>__*`, нет корневого CLAUDE.md. */
function checkRoles(ctx, out) {
  const { root, finding } = ctx;
  const dir = path.join(root, '.claude', 'agents');
  for (const a of ['intent', 'spec', 'kit', 'core']) {
    if (!fs.existsSync(path.join(dir, a + '.md'))) out.push(finding(`.claude/agents/${a}.md`, 'роль узла', 'нет файла'));
  }
  if (!fs.existsSync(dir) || !fs.readdirSync(dir).some((f) => /^run.*\.md$/.test(f))) out.push(finding('.claude/agents/run*.md', 'хотя бы один исполнитель', 'нет ни одного'));
  for (const f of walkFiles(dir).filter((x) => x.endsWith('.md'))) {
    const fm = fs.readFileSync(f, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const tools = fm && (fm[1].match(/^tools:.*$/m) || [''])[0];
    if (tools && /mcp__<[^>]*>/.test(tools)) out.push(finding(path.relative(root, f).split(path.sep).join('/') + ' — tools:', 'имена инструментов без плейсхолдеров', tools.match(/mcp__<[^>]*>[^,\s]*/)[0]));
  }
  if (fs.existsSync(path.join(root, 'CLAUDE.md'))) out.push(finding('CLAUDE.md', 'нет корневого CLAUDE.md (затеняет чтение AGENTS.md)', 'файл есть'));
}

/** Замыкание ссылок: `имя.md` в законе и §8 (строчные, без пути) называет файл, который лежит в `.claude/` или `.forma/`. */
function checkReferences(ctx, out) {
  const { root, finding } = ctx;
  const known = new Set();
  for (const d of ['.claude', '.forma']) for (const f of walkFiles(path.join(root, d))) known.add(path.basename(f));
  for (const src of ['AGENTS.md', '.claude/rules/claude-8.md']) {
    const f = path.join(root, src);
    if (!fs.existsSync(f)) { if (src !== 'AGENTS.md') out.push(finding(src, '§8 Claude Code', 'нет файла')); continue; }
    const seen = new Set();
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/`([a-z][a-z0-9-]*\.md)`/g)) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      if (!known.has(m[1])) out.push(finding(`${src} → \`${m[1]}\``, 'файл в .claude/ или .forma/', 'файла нет'));
    }
  }
}

/** Поведение: стартовый хук и сверка ядра с адаптером запускаются и отвечают, модель не вызывается. */
function checkBehavior(ctx, out) {
  const { root, finding } = ctx;
  const hook = path.join(root, '.claude', 'hooks', 'check-ready.sh');
  if (fs.existsSync(hook)) {
    const r = spawnSync('bash', [hook], { cwd: root, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
    if (r.error || r.status !== 0) out.push(finding('.claude/hooks/check-ready.sh', 'выход 0', r.error ? r.error.message : 'выход ' + r.status));
    else for (const l of (r.stdout || '').split('\n').filter((x) => /^\s+· (agents|паритет)/.test(x))) out.push(finding('.claude/hooks/check-ready.sh', 'без замечаний по ролям и паритету', l.trim()));
  }
  const sync = path.join(root, '.claude', 'scripts', 'sync-engines.cjs');
  if (fs.existsSync(sync)) {
    const r = spawnSync(process.execPath, [sync, '--check'], { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) {
      const why = ((r.stdout || '') + (r.stderr || '')).split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('— ')).slice(0, 5);
      out.push(finding('node .claude/scripts/sync-engines.cjs --check', 'выход 0', 'выход ' + r.status + (why.length ? ': ' + why.join(' | ') : '')));
    }
  }
}

function check(ctx) {
  const out = [];
  const expect = ctx.engine.expect || {};
  checkHooks(ctx, expect, out);
  checkRoles(ctx, out);
  checkReferences(ctx, out);
  if (ctx.behavior) checkBehavior(ctx, out);
  return out;
}

module.exports = { id: 'claude', check };
