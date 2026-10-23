'use strict';

// Паритет ролей Claude↔Gemini — сведение, не нарушение: роли равны по содержанию, сверяются нормализованным
// текстом. Codex читает роли Claude по ссылке и сверяется проверкой `codex`. Не проверка реестра, а таблица,
// которую печатает сверка.

const fs = require('fs');
const path = require('path');

const roots = require('./engine-roots.cjs');

const CORE_ROLES = ['core', 'intent', 'kit', 'run', 'spec', 'extractor'];
const RULE = '----------------------------------------------------------------------';

// Пять постоянных ролей (корневые правила больше не пара — они в AGENTS.md, одним файлом) — жёсткий список остаётся:
// это не растущий каталог, новая роль не заводится сама по себе, а решением человека.
const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const mdFiles = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')) : []);

// Пары строятся по адаптерам (engines.cjs): эталон — движок, в чьей папке лежит проверка, парой к нему идёт каждый
// другой движок с папкой ролей. Подключили четвёртый движок — он в сверке без правки этого файла; нет адаптера — нет пары.
function pairsFor(root, base, peer) {
  const bRoles = base.src.rolesDir;
  const bOnDemand = base.src.onDemandRolesDir || `${bRoles}/on-demand`;
  const pRoles = peer.src.rolesDir;
  const pOnDemand = peer.src.onDemandRolesDir || `${pRoles}/on-demand`;
  const core = CORE_ROLES.map((role) => ({
    name: `Agent: ${titleCase(role)}`, base: `${bRoles}/${role}.md`, peer: `${pRoles}/${role}.md`, type: 'agent',
  }));
  // Слой «по требованию» растёт без правки этого скрипта: сканирует оба каталога, сопоставляя по имени файла.
  // Файл, существующий только на одной стороне, всё равно попадает в пару — comparePair() увидит его как
  // missing_<движок>, не пропустит молча.
  const names = new Set([...mdFiles(path.join(root, bOnDemand)), ...mdFiles(path.join(root, pOnDemand))]);
  const onDemand = [...names].sort().map((file) => {
    const display = file.replace(/.md$/, '').split('-').map(titleCase).join(' ');
    return { name: `On-Demand: ${display}`, base: `${bOnDemand}/${file}`, peer: `${pOnDemand}/${file}`, type: 'on-demand' };
  });
  return [...core, ...onDemand].map((p) => ({ ...p, from: base.id, to: peer.id }));
}

/** Нормализация путей по всем адаптерам проекта: папка ролей, on-demand, скиллы, хуки, файл правил, корень движка. */
function pathNormalizers(root) {
  const all = roots.list(root);
  const re = (p, tail = '') => new RegExp(roots.escapeRe(p) + tail, 'g');
  const out = [];
  const add = (p, to, tail) => { if (p) out.push([re(p, tail), to]); };
  for (const e of all) { // файл правил движка: полный путь, затем имя
    const rules = e.adapter.engineRulesFile;
    if (rules) { add(rules, 'ENGINE_RULES.md'); add(path.posix.basename(rules), 'ENGINE_RULES.md'); }
  }
  for (const e of all) add(`${e.src.onDemandRolesDir || e.src.rolesDir + '/on-demand'}/`, 'AGENTS_DIR/on-demand/');
  for (const e of all) {
    add(`${e.dir}/hooks/guard-delete.sh`, 'HOOK_GUARD');
    add(`${e.dir}/hooks/guard-delete.ps1`, 'HOOK_GUARD');
    add(`${e.dir}/hooks/.delete-unlock`, 'HOOK_UNLOCK');
  }
  for (const e of all) add(`${e.src.skillsDir}/`, 'SKILLS_DIR/');
  for (const e of all) add(`${e.src.rolesDir}/`, 'AGENTS_DIR/');
  for (const e of all) add(`${e.dir}/`, 'ENGINE_DIR/');
  // Папка расширений проекта и тег движка в строке расхода называются именем движка — это не расхождение смысла.
  for (const e of all) add(`project/extensions/${e.dir.replace(/^./, '')}/`, 'project/extensions/ENGINE_ID/');
  for (const e of all) add(`${e.adapter.spendTag || e.adapter.engine}:`, 'ENGINE_TAG:');
  for (const e of all) add(`${path.posix.basename(e.src.skillsDir)}/`, 'SKILLS_DIR/');
  return out;
}

// Что различает роли двух движков и не является расхождением смысла: имена файлов и каталогов, способ вызова
// инструмента, формулировки о среде. Порядок строк — порядок применения.
// Пути (папки движков, ролей, скиллов, хуков, файл правил) нормализует `pathNormalizers` — по адаптерам проекта;
// здесь — то, что не путь: имена файлов правил в тексте и формулировки о среде.
const NORMALIZERS_BEFORE_PATHS = [
  [/CLAUDE\.md/g, 'ENGINE_RULES.md'],
  [/GEMINI\.md/g, 'ENGINE_RULES.md'],
  [/\s*\((Gemini Engine|Claude Code)\)/g, ''],
];
const AGENT_NORMALIZERS = [
  [/\b[A-Za-z]+-8\.md/g, 'ENGINE_RULES.md'], // §8 of any engine is `<engine>-8.md`; named without a path it needs no adapter to be read
  [/agents\/on-demand\//g, 'AGENTS_DIR/on-demand/'],
  [/\bagents\//g, 'AGENTS_DIR/'],
  [/(\b(intent|spec|kit|run|core)\.md\b)/g, 'AGENTS_DIR/$1'],
  [/AGENTS_DIR\/AGENTS_DIR\//g, 'AGENTS_DIR/'],
  [/skills already available in (Claude Code|the environment)/g, 'skills already available in the environment'],
  [/call `?Skill`?/g, 'call the skill'],
  [/global ones \([^)]+\) and plugin ones \([^)]+\)/g, 'global and plugin ones'],
  [/Bash\((node [^)]+)\)/g, '$1'],
  [/Cost is checked with `simulate_cost`/g, 'Cost is checked'],
  [/the (Antigravity )?plugin marketplace/g, 'the plugin marketplace'],
  [/connected plugin sources( \([^)]+\)|, where the platform provides them)?/g, 'connected plugin sources'],
  [/\(`?new_page`?\s*\+\s*`?take_snapshot`?\)/g, '(`browser_tool`)'],
  [/\(`?browser_subagent`?\)/g, '(`browser_tool`)'],
  [/\(`extractor\.md`(, `omitClaudeMd: true`)?\)/g, '(`extractor.md`)'],
  [/the browser \(`browser_tool`\) is a fallback/g, 'the browser is a fallback'],
  [/## After work \(the "Result" section\)/g, '## After work'],
  [/, read on demand, never entering the cycle cache/g, ''],
  [/The bridge \([^)]+\) stays with you/g, 'The external bridge stays with you'],
  [/The bridge stays with you/g, 'The external bridge stays with you'],
  [/The bridge stays available to you/g, 'The external bridge stays with you'],
  [/The external channel stays available to you/g, 'The external bridge stays with you'],
  [/The bridge \([^)]+\)/g, 'The external bridge'],
  [/the text-to-text bridge gives no live access/g, 'the text-to-text external channel gives no live access'],
  [/internal model \(Agent tool\)/g, 'internal model'],
  [/, local `Bash`/g, ''],
  [/\(needs `execute-php`\/Novamira abilities — you deliberately don't have these, only the `Aura` catalog\)/g, "(needs site access you deliberately don't have)"],
  [/`?Spec`? also keeps the bridge/g, '`Spec` also keeps the external channel'],
  [/set your own tier to (the strongest one|`?strongest`?)( in `?AGENTS_DIR\/kit\.md`?)?/g, 'set your own tier to the strongest one'],
  [/A plugin (from `?claude plugin marketplace`?|connected globally to the environment)/g, 'A plugin from marketplace'],
  [/(A plugin from the marketplace|A globally-connected plugin) goes the same way/g, 'A marketplace/global plugin goes the same way'],
  [/already available (in Claude Code|to the environment)/g, 'already available in the environment'],
  [/call (the skill|it), copy/g, 'call the skill, copy'],
  [/node (ENGINE_DIR\/scripts|dashboard)\/tally\.cjs( \*)?/g, 'node ENGINE_DIR/scripts/tally.cjs'],
  [/Every bridge call is also an attempt[\s\S]*?never by eye\./g, 'Every external call is an attempt, caller writes line.'],
  [/Every call through the external channel is also an attempt[\s\S]*?never by eye\./g, 'Every external call is an attempt, caller writes line.'],
];

/** Текст к сравнению: без различий переводов строк и концевых пробелов; у ролей — ещё и без различий движка. */
function normalizeText(text, type, pathRules = []) {
  let norm = text.replace(/\r\n/g, '\n');
  norm = norm.split('\n').map((l) => l.trimEnd()).join('\n').trim();
  if (type === 'agent' || type === 'on-demand') {
    for (const [re, to] of [...NORMALIZERS_BEFORE_PATHS, ...pathRules, ...AGENT_NORMALIZERS]) norm = norm.replace(re, to);
    // Игнорируем специфичные поля фронтматтера (model, tools, effort)
    norm = norm.replace(/^---[\s\S]*?---\n/m, '');
  }
  return norm;
}

/** Первые три расходящиеся строки двух текстов для диагностики. */
function lineDiffs(baseNorm, peerNorm) {
  const bLines = baseNorm.split('\n');
  const pLines = peerNorm.split('\n');
  const max = Math.max(bLines.length, pLines.length);
  const diffs = [];
  for (let i = 0; i < max; i++) {
    if (bLines[i] === pLines[i]) continue;
    diffs.push(`Line ${i + 1}:\n  <base>: ${bLines[i] || '[EOF]'}\n  <peer>: ${pLines[i] || '[EOF]'}`);
    if (diffs.length >= 3) {
      diffs.push(`... (всего расхождений строк: ${Math.abs(bLines.length - pLines.length) + diffs.length})`);
      break;
    }
  }
  return diffs.join('\n');
}

/** Пара файлов: `{ status: synced|drift|missing_*, diff }`. */
function comparePair(root, pair, pathRules = pathNormalizers(root)) {
  const basePath = path.join(root, pair.base);
  const peerPath = path.join(root, pair.peer);
  const baseExists = fs.existsSync(basePath);
  const peerExists = fs.existsSync(peerPath);
  if (!baseExists && !peerExists) return { status: 'missing_both', diff: 'Both files missing' };
  if (!baseExists) return { status: 'missing_' + pair.from, diff: `Missing ${pair.base}` };
  if (!peerExists) return { status: 'missing_' + pair.to, diff: `Missing ${pair.peer}` };
  const baseNorm = normalizeText(fs.readFileSync(basePath, 'utf8'), pair.type, pathRules);
  const peerNorm = normalizeText(fs.readFileSync(peerPath, 'utf8'), pair.type, pathRules);
  if (baseNorm === peerNorm) return { status: 'synced', diff: null };
  return { status: 'drift', diff: lineDiffs(baseNorm, peerNorm) };
}

/** Все пары ролей проекта и итог сверки каждой: `[{ pair, res }]`. */
function compareRoles(root, { only } = {}) {
  const base = roots.own(root);
  if (!base || !base.src.rolesDir) return [];
  const pathRules = pathNormalizers(root);
  return roots.peers(root).filter((p) => !only || [].concat(only).includes(p.id)).flatMap((peer) => pairsFor(root, base, peer))
    .map((pair) => ({ pair, res: comparePair(root, pair, pathRules) }));
}

/** Заголовок и строки таблицы паритета — в порядке печати. */
function parityTable(results) {
  const lines = [
    `Паритет ролей ${[...new Set(results.map(({ pair }) => pair.from + '↔' + pair.to))].join(', ') || '(нет пар)'} — сведение, не нарушение (роли не копируются):`,
    '| Компонент | Файл эталона | Файл движка | Статус |',
    '|---|---|---|---|',
  ];
  for (const { pair, res } of results) {
    const icon = res.status === 'synced' ? '✓ Паритет' : `✗ Дрейф (${res.status})`;
    lines.push(`| ${pair.name.padEnd(25)} | ${pair.base.padEnd(35)} | ${pair.peer.padEnd(45)} | ${icon} |`);
  }
  return lines;
}

/** Строки расхождений по парам с дрейфом (для `--diff`). */
function driftDetails(results) {
  const lines = [];
  for (const { pair, res } of results) {
    if (res.status === 'synced' || !res.diff) continue;
    lines.push(`--- [ ${pair.name} ] ---`, res.diff, RULE + '\n');
  }
  return lines;
}

module.exports = { RULE, compareRoles, comparePair, normalizeText, parityTable, driftDetails };
