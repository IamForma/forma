// Данные вкладки «Схема»: buildSchema (schema.cjs) + тип каждого файла и счётчики состава по блокам.
// Тип выводится по пути и виду файла, списков файлов здесь нет.
'use strict';
const { buildSchema } = require('./schema.cjs');

const TYPES = ['scripts', 'rules', 'hooks', 'knowledge', 'graphs', 'structural'];

/** Тип файла: хуки и графы по пути, затем скрипт/правило/знание, остальное структурное. */
function typeOf(f) {
  const p = f.path;
  if (/(^|\/)hooks(\/|\.json$)|(^|\/)settings\.json$|(^|\/)permission-levels\.json$/.test(p)) return 'hooks';
  if (/graph/i.test(p)) return 'graphs';
  if (f.kind === 'script') return 'scripts';
  if (/(^|\/)rules\/|^AGENTS\.md$|(^|\/)config\//.test(p)) return 'rules';
  if (f.kind === 'doc') return 'knowledge';
  return 'structural';
}

function buildSchemaView(root) {
  const s = buildSchema(root);
  const byPath = new Map();
  for (const f of s.files) { f.type = typeOf(f); byPath.set(f.path, f); }
  for (const b of s.blocks) {
    b.counts = Object.fromEntries(TYPES.map((k) => [k, 0]));
    for (const p of b.files) { const f = byPath.get(p); if (f) b.counts[f.type] += 1; }
  }
  s.types = TYPES;
  return s;
}

module.exports = { buildSchemaView, typeOf, TYPES };
