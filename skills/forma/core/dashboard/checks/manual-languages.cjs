'use strict';

// manual: английский — оригинал, русский — точная копия. Сверяется набор файлов и число заголовков в каждой паре —
// не текст: смысл сверяет человек. Проверка ядра; в реестр её ставит сверка движка.

const fs = require('fs');
const path = require('path');
const { walk } = require('../lib/fs.cjs');

const headingCount = (file) => (fs.readFileSync(file, 'utf8').match(/^#{1,3} /gm) || []).length;

function run({ root }) {
  const problems = [];
  const en = path.join(root, '.forma/manual', 'en');
  const ru = path.join(root, '.forma/manual', 'ru');
  if (!fs.existsSync(en) && !fs.existsSync(ru)) return problems;
  const E = new Set(walk(en, { ext: '.md', symlinks: true }));
  const R = new Set(walk(ru, { ext: '.md', symlinks: true }));
  for (const f of E) if (!R.has(f)) problems.push(`.forma/manual/en/${f}: нет русской копии в .forma/manual/ru/`);
  for (const f of R) if (!E.has(f)) problems.push(`.forma/manual/ru/${f}: нет английского оригинала в .forma/manual/en/`);
  for (const f of E) {
    if (!R.has(f)) continue;
    const a = headingCount(path.join(en, f));
    const b = headingCount(path.join(ru, f));
    if (a !== b) problems.push(`.forma/manual/{en,ru}/${f}: заголовков ${a} против ${b} — копия разошлась с оригиналом`);
  }
  return problems;
}

module.exports = { id: 'manual-languages', since: null, run };
