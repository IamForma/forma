#!/usr/bin/env node
'use strict';
// Инвентаризация литералов в CSS-файлах: цвет (#hex, rgb/hsl), px, радиусы, высоты.
// Только чтение. Использование: node audit-css-literals.cjs <css-dir> <out.json>
// Выход (stdout, последняя строка): {"status":"ok|stop","files":N,"literals":M,"out":"..."}
const fs = require('fs'), path = require('path');
const [dir, out] = process.argv.slice(2);
if (!dir || !out) { console.log(JSON.stringify({ status: 'stop', reason: 'usage: <css-dir> <out.json>' })); process.exit(0); }
const types = [
  ['color', /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/g],
  ['px', /(?<![\w.#-])-?\d+(?:\.\d+)?px\b/g],
];
const res = []; let files = 0;
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.css')).sort()) {
  files++;
  const lines = fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/);
  let sel = '';
  lines.forEach((ln, i) => {
    const m = ln.match(/^\s*([^{}\/][^{}]*)\{/); if (m) sel = m[1].trim();
    const decl = ln.match(/^\s*([\w-]+)\s*:/); const prop = decl ? decl[1] : '';
    const isVar = /^\s*--/.test(ln);
    for (const [t, re] of types) for (const x of ln.matchAll(re)) {
      let kind = t;
      if (t === 'color' && /^rgba?\(/.test(x[0])) kind = 'rgba';
      else if (t === 'px' && /radius/.test(prop)) kind = 'radius';
      else if (t === 'px' && /height/.test(prop)) kind = 'height';
      res.push({ file: f, line: i + 1, selector: sel, prop, kind, literal: x[0], inVarDef: isVar });
    }
  });
}
fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ status: 'ok', files, literals: res.length, out }));
