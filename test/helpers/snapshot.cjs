// Снимок buildData на фикстуре: сборка в отдельном процессе с изолированным HOME,
// затем нормализация всего, что зависит от машины и времени.
const path = require('node:path');
const { runNode } = require('./fixture.cjs');

// Ключи, чьё значение — время сборки или возраст файла; заменяются маркером.
const VOLATILE_KEYS = new Set(['generatedAt', 'generated', 'ageHours', 'mtime']);
// Ветки, которые читают стенограммы и настройки машины (~/.claude, ~/.claude.json, ~/.codex) —
// исключаются целиком, чтобы снимок не зависел от хоста.
const EXCLUDED_BRANCHES = ['dialog', 'sessionEconomy', 'settings.engine', 'bort'];

function buildDataRaw(fx) {
  const gen = path.join(fx.root, '.forma', 'dashboard', 'generate.js');
  const code = `process.stdout.write(JSON.stringify(require(${JSON.stringify(gen)}).buildData(${JSON.stringify(fx.root)})))`;
  const r = runNode(fx, ['-e', code]);
  if (r.status !== 0) throw new Error('buildData упал:\n' + r.stderr);
  return JSON.parse(r.stdout);
}

const slash = (s) => s.split('\\').join('/');

function normalizeString(s, fx) {
  const pairs = [[fx.root, '<ROOT>'], [slash(fx.root), '<ROOT>'], [fx.home, '<HOME>'], [slash(fx.home), '<HOME>']];
  let out = s;
  for (const [from, to] of pairs) out = out.split(from).join(to);
  return out.split('\r\n').join('\n');
}

function normalize(data, fx) {
  const d = JSON.parse(JSON.stringify(data));
  for (const p of EXCLUDED_BRANCHES) {
    const keys = p.split('.');
    let o = d;
    for (const k of keys.slice(0, -1)) o = o && o[k];
    if (o && keys[keys.length - 1] in o) o[keys[keys.length - 1]] = '<excluded>';
  }
  if (d.project === path.basename(fx.root)) d.project = '<ROOT-NAME>';
  const walk = (v, key) => {
    if (VOLATILE_KEYS.has(key) && v !== null && v !== undefined) return '<time>';
    if (typeof v === 'string') return normalizeString(v, fx);
    if (Array.isArray(v)) return v.map((x) => walk(x, ''));
    if (v && typeof v === 'object') {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = walk(v[k], k);
      return out;
    }
    return v;
  };
  return walk(d, '');
}

function snapshot(fx) {
  return JSON.stringify(normalize(buildDataRaw(fx), fx), null, 2) + '\n';
}

module.exports = { snapshot, normalize, buildDataRaw, VOLATILE_KEYS, EXCLUDED_BRANCHES };
