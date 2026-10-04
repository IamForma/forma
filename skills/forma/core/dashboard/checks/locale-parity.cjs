'use strict';

// Локализация дашборда: словари `locales/en.json` и `ru.json` совпадают по ключам; каждый ключ из кода и разметки
// есть в словарях; в словарях нет неиспользуемых ключей; в `web/` (js, html, css-`content`) нет кириллицы вне комментариев.
// Проверка ядра; в реестр её ставит сверка движка. Динамические ключи (`t('chain.v.' + kind)`) покрываются префиксом.

const fs = require('fs');
const path = require('path');
const { walk } = require('../lib/fs.cjs');

const CYR = /[А-Яа-яЁё]/;
const stripJs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/[ \t]\/\/ .*$/gm, '');
const stripHtml = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
const rd = (f) => fs.readFileSync(f, 'utf8');
// Строка с меткой `i18n-keep` — кириллица как данные (имя поля карточки, родное имя языка): не нарушение.
const dropKept = (s) => s.split('\n').filter((l) => !l.includes('i18n-keep')).join('\n');

function readDict(dir, lang) {
  try { return JSON.parse(rd(path.join(dir, 'locales', lang + '.json'))); } catch (e) { return { __error: e.message }; }
}

function run({ root }) {
  const dir = path.join(root, '.forma/dashboard');
  const rel = (f) => '.forma/dashboard/' + path.relative(dir, f).split(path.sep).join('/');
  if (!fs.existsSync(path.join(dir, 'locales'))) return [];
  const problems = [];
  const en = readDict(dir, 'en'), ru = readDict(dir, 'ru');
  for (const [l, d] of [['en', en], ['ru', ru]]) if (d.__error) problems.push(`.forma/dashboard/locales/${l}.json: не читается — ${d.__error}`);
  if (en.__error || ru.__error) return problems;

  for (const k of Object.keys(en)) if (!(k in ru)) problems.push(`locales: ключа «${k}» нет в ru.json (есть в en.json)`);
  for (const k of Object.keys(ru)) if (!(k in en)) problems.push(`locales: ключа «${k}» нет в en.json (есть в ru.json)`);

  const web = walk(path.join(dir, 'web'), { abs: true, tolerant: true }).filter((f) => /\.(js|css)$/.test(f));
  const all = [...web, path.join(dir, 'index.html')].filter((f) => fs.existsSync(f));
  const code = walk(dir, { abs: true, tolerant: true, skip: (e) => e.isDirectory() && /^(node_modules|locales|test)$/.test(e.name) })
    .filter((f) => /\.(js|cjs|html)$/.test(f) && !/\.test\.cjs$/.test(f));

  const used = new Set(), prefixes = new Set();
  for (const f of code) {
    const text = rd(f);
    for (const m of text.matchAll(/\b(?:t|cnt|tr)\(\s*(?:[a-z]+,\s*)?'([\w.\/-]+)'\s*([,)+])/g)) (m[2] === '+' ? prefixes : used).add(m[1]);
    for (const m of text.matchAll(/\b(?:t|cnt)\(\s*`([\w.\/-]+)\$\{/g)) prefixes.add(m[1]);
    for (const m of text.matchAll(/data-i18n(?:-ph|-title)?="([\w.\/-]+)"/g)) used.add(m[1]);
    for (const m of text.matchAll(/key:\s*'([\w.\/-]+)'/g)) used.add(m[1]);
    for (const m of text.matchAll(/'((?:[a-z]+\.)+[\w.\/-]*)'\s*\+/g)) prefixes.add(m[1]);
    for (const m of text.matchAll(/['"]([a-z]+(?:\.[\w-]+)+\.?)['"]/g)) (m[1].endsWith('.') ? prefixes : used).add(m[1]);
    for (const m of text.matchAll(/stTr\('([gk])'/g)) prefixes.add('st.' + m[1] + '.');
  }
  const isUsed = (k) => used.has(k) || [...prefixes].some((p) => k.startsWith(p));
  for (const f of code) {
    const text = rd(f);
    for (const m of text.matchAll(/\b(?:t|cnt)\(\s*'([\w.-]+)'\s*[,)]/g)) if (!(m[1] in en)) problems.push(`${rel(f)}: ключ «${m[1]}» из кода есть не во всех словарях`);
    for (const m of text.matchAll(/data-i18n(?:-ph|-title)?="([\w.-]+)"/g)) if (!(m[1] in en)) problems.push(`${rel(f)}: ключ «${m[1]}» из разметки есть не во всех словарях`);
  }
  for (const k of Object.keys(en)) if (k in ru && !k.startsWith('_meta.') && !isUsed(k)) problems.push(`locales: ключ «${k}» нигде не используется`);

  for (const f of all) {
    let s = rd(f);
    if (f.endsWith('.css')) { const hit = s.replace(/\/\*[\s\S]*?\*\//g, '').match(/content:\s*["'][^"']*[А-Яа-яЁё][^"']*/); if (hit) problems.push(`${rel(f)}: кириллица в content — ${hit[0].slice(0, 60)}`); continue; }
    s = dropKept(s); s = f.endsWith('.html') ? stripHtml(s) : stripJs(s);
    const hit = s.match(/.{0,25}[А-Яа-яЁё]+.{0,15}/);
    if (hit && CYR.test(hit[0])) problems.push(`${rel(f)}: кириллица вне словарей — «${hit[0].trim()}»`);
  }
  return problems;
}

module.exports = { id: 'locale-parity', since: null, run };
