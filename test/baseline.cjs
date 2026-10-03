#!/usr/bin/env node
// Точка отсчёта «до» для рефакторинга: снимок buildData и выводы проверок на фикстуре.
//   node test/baseline.cjs save   — записать в test/.baseline/ (вне git: зависит от ОС и переводов строк)
//   node test/baseline.cjs diff   — сравнить текущее с записанным; расхождение — код 1
// npm test сравнивает с test/.baseline/ сам, если она есть.
const fs = require('node:fs');
const path = require('node:path');
const { makeFixture } = require('./helpers/fixture.cjs');
const { collect } = require('./helpers/outputs.cjs');

const DIR = path.join(__dirname, '.baseline');

function firstDiff(a, b) {
  const al = a.split('\n');
  const bl = b.split('\n');
  for (let i = 0; i < Math.max(al.length, bl.length); i++) {
    if (al[i] !== bl[i]) return `строка ${i + 1}:\n  было:  ${al[i]}\n  стало: ${bl[i]}`;
  }
  return '';
}

function main() {
  const mode = process.argv[2];
  if (mode !== 'save' && mode !== 'diff') {
    console.error('использование: node test/baseline.cjs save|diff');
    process.exit(2);
  }
  const fx = makeFixture();
  try {
    const now = collect(fx);
    if (mode === 'save') {
      fs.mkdirSync(DIR, { recursive: true });
      for (const [name, text] of Object.entries(now)) fs.writeFileSync(path.join(DIR, name), text);
      console.log(`записано ${Object.keys(now).length} файлов → ${path.relative(process.cwd(), DIR)}`);
      return;
    }
    let bad = 0;
    for (const [name, text] of Object.entries(now)) {
      const file = path.join(DIR, name);
      if (!fs.existsSync(file)) { console.log(`нет ${name} — сначала save`); bad++; continue; }
      const d = firstDiff(fs.readFileSync(file, 'utf8'), text);
      console.log(d ? `✗ ${name}: ${d}` : `✓ ${name}`);
      if (d) bad++;
    }
    process.exitCode = bad ? 1 : 0;
  } finally {
    fx.cleanup();
  }
}

main();
