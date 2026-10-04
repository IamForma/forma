#!/usr/bin/env node
// Перенос правок движка проекта в исходник протокола: ядро — protocol/skills/forma/core/ (закон, manual,
// дашборд с модулем экономики, каркас project/), адаптеры — protocol/skills/forma/adapters/<движок>/
// (claude — готов; codex, gemini — «не готов», переносятся как есть).
// Только для автора: работает, лишь если protocol/ — git-клон (есть protocol/.git).
//   node .forma/protocol/scripts/engine-to-protocol.cjs      — показать классификацию, ничего не пишет
//   ... --apply                                              — перенести «изменён только движок»
//   ... --add <путь-в-проекте> [--add ...]                   — явно перенести новый файл
//   ... --mark                                               — записать базу: движок = шаблон на HEAD protocol/
//   ... --before-push                                        — проверка перед push: версия строго выше опубликованной
//
// Направление определяется по git, не по mtime (mtime после clone/checkout = время checkout, врёт).
// База — коммит protocol/, на котором движок и шаблон последний раз совпадали; хранится в
// protocol/.git/forma-base (вне истории, у каждого клона свой). Для каждого файла три содержимого:
// B = шаблон@база, H = шаблон сейчас, E = движок. Изменён только движок (E≠B, H=B) → переносится;
// только шаблон (E=B, H≠B) → «обнови протокол Форма»; оба → конфликт, решает человек.
// Базы нет — она выводится по файлу: самая новая версия шаблона из git log, равная E.
// Намеренные отличия и мусор — protocol/scripts/engine-to-protocol.exceptions.
'use strict';
const fs = require('fs');
const path = require('path');
const { walk: walkTree } = require('../skills/forma/core/dashboard/lib/fs.cjs');
const { gitOut } = require('./lib/git.cjs');
const { readOwnLayer, isForbiddenTransfer } = require('./lib/forbidden-transfer.cjs');

const root = process.cwd();
const protoDir = path.join(root, '.forma/protocol');
const FORMA_GIT = 'skills/forma';
const TPL_GIT = FORMA_GIT + '/core';
const tpl = path.join(protoDir, ...TPL_GIT.split('/'));
const forma = path.join(protoDir, ...FORMA_GIT.split('/'));
const baseFile = path.join(protoDir, '.git', 'forma-base');

if (!fs.existsSync(path.join(protoDir, '.git'))) {
  console.error('СТОП: protocol/.git нет — это не клон IamForma/forma. Механизм только для автора (README, «Разработка протокола из любого проекта»).');
  console.error('Запускать из корня проекта, где protocol/ — git-клон.');
  process.exit(2);
}
if (!fs.existsSync(tpl)) { console.error('СТОП: нет ' + path.relative(root, tpl)); process.exit(2); }

const args = process.argv.slice(2);
const git = (...a) => gitOut(protoDir, ...a);

// --before-push: после pull --rebase, перед push. Одинаковый bump на обеих сторонах git сливает МОЛЧА
// (строки совпали — конфликта нет), и два выпуска получают один номер. Ловим это здесь.
if (args.includes('--before-push')) {
  const ver = (ref) => JSON.parse(git('show', ref + ':.claude-plugin/plugin.json')).version;
  const cmp = (x, y) => { const a = x.split('-')[0].split('.').map(Number), b = y.split('-')[0].split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
  let up; try { up = git('rev-parse', '--abbrev-ref', '@{u}').trim(); } catch { console.error('СТОП: у ветки protocol/ нет upstream.'); process.exit(2); }
  if (git('status', '--porcelain').trim()) { console.error('СТОП: в protocol/ незакоммиченное или незавершённый rebase.'); process.exit(1); }
  const mine = ver('HEAD'), theirs = ver(up);
  if (git('rev-list', '--count', up + '..HEAD').trim() === '0') { console.log('Нечего пушить: HEAD не впереди ' + up + '.'); process.exit(0); }
  if (git('rev-list', '--count', 'HEAD..' + up).trim() !== '0') { console.error('СТОП: ' + up + ' ушёл вперёд — сначала git -C protocol pull --rebase.'); process.exit(1); }
  if (cmp(mine, theirs) <= 0) { console.error('СТОП: версия ' + mine + ' не больше опубликованной ' + theirs + ' (' + up + '). Поднимите patch после пришедшего, amend, повторите.'); process.exit(1); }
  console.log('OK: ' + theirs + ' → ' + mine + ', история линейна. Пуш — по команде человека: git -C protocol push');
  process.exit(0);
}
const apply = args.includes('--apply');
const mark = args.includes('--mark');
const adds = [];
for (let i = 0; i < args.length; i++) if (args[i] === '--add' && args[i + 1]) adds.push(args[++i].replace(/\\/g, '/'));

// --- исключения ---
const SKIP = [], MASK = {};
const excFile = path.join(protoDir, 'scripts', 'engine-to-protocol.exceptions');
if (fs.existsSync(excFile)) {
  for (const raw of fs.readFileSync(excFile, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(skip|mask)\s+(\S+)(?:\s+(.+))?$/);
    if (!m) { console.error('СТОП: непонятная строка исключений: ' + raw); process.exit(2); }
    if (m[1] === 'skip') SKIP.push(new RegExp(m[2]));
    else (MASK[m[2]] = MASK[m[2]] || []).push(new RegExp(m[3]));
  }
}
// Слой 4 (.claude/project-layer.txt) и зоны, что физически не бывают в шаблоне протокола — не «новое»,
// не переносятся ни по --apply, ни по --add, ни попаданием в MAP (lib/forbidden-transfer.cjs).
const OWN_LAYER = readOwnLayer(root);
const forbidden = (rel) => isForbiddenTransfer(rel, OWN_LAYER);
const skipped = (rel) => forbidden(rel) || SKIP.some((r) => r.test(rel));
const MASKED = '\u0000masked\u0000';
const norm = (s) => s.replace(/\r\n/g, '\n');
const mask = (rel, s) => { if (s == null) return null; const rs = MASK[rel]; s = norm(s);
  return rs ? s.split('\n').map((l) => (rs.some((r) => r.test(l)) ? MASKED : l)).join('\n') : s; };

// проект → шаблон. living/ и project/ исключены намеренно: это история и содержимое конкретного проекта.
// Пути шаблона — от protocol/skills/forma/. Сравниваются только файлы, которые в шаблоне уже есть.
const MAP = [
  // ядро
  ['AGENTS.md', 'core/AGENTS.md'],
  ['.forma/dashboard', 'core/dashboard'],
  ['.forma/manual', 'core/manual'],
  ['.forma/skills', 'core/skills'],   // интервью — ядро; .claude/skills/<интервью> — доставленная копия, в адаптер не идёт
  ['.forma/board', 'core/board'],
  // адаптер Claude (читатели стенограмм Claude живут в .forma/dashboard проекта, но принадлежат адаптеру)
  ['.claude/forma-adapter.cjs', 'adapters/claude/forma-adapter.cjs'],   // граница ядро — адаптер: `dashboard/lib/engines.cjs`
  ['.claude/agents', 'adapters/claude/agents'],
  ['.claude/hooks', 'adapters/claude/hooks'],
  ['.claude/rules', 'adapters/claude/rules'],
  ['.claude/scripts', 'adapters/claude/scripts'],
  ['.claude/skills', 'adapters/claude/skills'],
  ['.forma/dashboard', 'adapters/claude/dashboard', { noFresh: true }],
  // адаптеры «не готов» — как есть
  ['.agents/forma-adapter.cjs', 'adapters/gemini/forma-adapter.cjs'],   // граница ядро — адаптер: `dashboard/lib/engines.cjs`
  ['.agents/plugins/forma/agents', 'adapters/gemini/agents'],
  ['.agents/rules', 'adapters/gemini/rules'],
  ['.agents/skills', 'adapters/codex/.agents/skills'],
  ['.codex', 'adapters/codex/.codex'],
];
// Файл проекта, уже известный одному из отображений (например dashboard/floor.cjs — адаптеру Claude),
// для другого отображения того же каталога не «новый».
const KNOWN = new Set();
for (const [p, t] of MAP) {
  const tAbs = path.join(forma, t);
  if (!fs.existsSync(tAbs)) continue;
  if (fs.statSync(tAbs).isFile()) KNOWN.add(p); else for (const f of walk(tAbs)) KNOWN.add(p + '/' + f);
}

// Файлы под каталогом (пути через «/»); сам файл — `['']`; нет пути — `[]`.
function walk(abs) {
  return fs.existsSync(abs) && fs.statSync(abs).isFile() ? [''] : walkTree(abs, { symlinks: true });
}
// число строк, которые есть в одной версии и нет в другой (мультимножество)
function ldiff(a, b) {
  const m = new Map(); let d = 0;
  for (const l of a.split('\n')) m.set(l, (m.get(l) || 0) + 1);
  for (const l of b.split('\n')) { const k = m.get(l) || 0; if (k) m.set(l, k - 1); else d++; }
  for (const v of m.values()) d += v;
  return d;
}
// Разрез ядро/адаптеры переименовал каталоги шаблона; база до разреза знает файл по старому пути.
const LEGACY = [[FORMA_GIT + '/core/', FORMA_GIT + '/template/'], [FORMA_GIT + '/adapters/claude/dashboard/', FORMA_GIT + '/template/dashboard/'],
  [FORMA_GIT + '/adapters/claude/', FORMA_GIT + '/template/'], [FORMA_GIT + '/adapters/gemini/', FORMA_GIT + '/templates-gemini/'],
  [FORMA_GIT + '/adapters/codex/', FORMA_GIT + '/templates-codex/']];
const show0 = (ref, gp) => { try { return git('show', ref + ':' + gp); } catch { return null; } };
const show1 = (ref, gp) => { const v = show0(ref, gp); if (v != null) return v;
  const l = LEGACY.find(([n]) => gp.startsWith(n)); return l ? show0(ref, l[1] + gp.slice(l[0].length)) : null; };

let base = null;
if (fs.existsSync(baseFile)) {
  base = fs.readFileSync(baseFile, 'utf8').trim();
  try { git('cat-file', '-e', base + '^{commit}'); } catch { console.error('СТОП: база ' + base + ' из protocol/.git/forma-base не найдена в истории protocol/.'); process.exit(2); }
}

// классы: engine — изменён только движок; template — только шаблон; conflict — оба; same — отличаются лишь исключения
const R = { engine: [], template: [], conflict: [], same: [], fresh: [] };
for (const [p, t, opt] of MAP) {
  const pAbs = path.join(root, p), tAbs = path.join(forma, t);
  const isFile = fs.existsSync(tAbs) && fs.statSync(tAbs).isFile();
  const tFiles = walk(tAbs);
  // Файл проекта, которого в шаблоне ещё нет, — новый; переносится по --add (каталог такой записью не станет).
  if (!isFile && !fs.existsSync(tAbs) && fs.existsSync(pAbs) && fs.statSync(pAbs).isFile()) {
    if (!skipped(p)) R.fresh.push({ rel: p, src: pAbs, dst: tAbs });
    continue;
  }
  for (const f of tFiles) {
    const src = isFile ? pAbs : path.join(pAbs, f);
    const dst = isFile ? tAbs : path.join(tAbs, f);
    const rel = isFile ? p : p + '/' + f;
    const gp = FORMA_GIT + '/' + (isFile ? t : t + '/' + f);
    if (skipped(rel) || !fs.existsSync(src)) continue;
    const eRaw = fs.readFileSync(src, 'utf8'), hRaw = fs.readFileSync(dst, 'utf8');
    if (norm(eRaw) === norm(hRaw)) continue;
    const E = mask(rel, eRaw), H = mask(rel, hRaw);
    const x = { rel, src, dst, eRaw, hRaw };
    if (E === H) { R.same.push(x); continue; }
    let B, how;
    if (base) { B = mask(rel, show1(base, gp)); how = 'база ' + base.slice(0, 7); }
    else {
      // база не записана: самая новая версия шаблона, равная движку
      const revs = git('log', '--follow', '--format=%H', '--', gp).split('\n').filter(Boolean);
      const hit = revs.find((c) => mask(rel, show1(c, gp)) === E);
      if (hit) { B = E; how = 'движок = шаблон@' + hit.slice(0, 7); }
      else {
        // точной нет: оценка — ближайшая к движку версия шаблона (меньше всего отличающихся строк)
        let best = null, bd = Infinity;
        for (const c of revs) { const v = mask(rel, show1(c, gp)); if (v == null) continue; const d = ldiff(E, v); if (d < bd) { bd = d; best = { c, v }; } }
        B = best ? best.v : H;
        how = best ? 'оценка: ближайшая версия шаблона @' + best.c.slice(0, 7) + (best.c === revs[0] ? ' (HEAD)' : '') : 'истории нет';
      }
    }
    x.how = how;
    const eCh = E !== B, hCh = H !== B;
    (eCh && hCh ? R.conflict : eCh ? R.engine : R.template).push(x);
  }
  if (isFile || (opt && opt.noFresh)) continue;
  const known = new Set(tFiles);
  const topKnown = new Set(tFiles.map((f) => f.split('/')[0]));
  for (const f of walk(pAbs)) {
    const rel = p + '/' + f;
    if (known.has(f) || KNOWN.has(rel) || skipped(rel)) continue;
    if (/skills$/.test(t) && !topKnown.has(f.split('/')[0])) continue;
    R.fresh.push({ rel, src: path.join(pAbs, f), dst: path.join(tAbs, f) });
  }
}

console.log('База: ' + (base ? base.slice(0, 7) + ' (protocol/.git/forma-base)' : 'не записана — выводится по истории каждого файла; после синхронизации: --mark'));
const out = (title, list) => { console.log(`${title}: ${list.length}`); for (const x of list) console.log('  ' + x.rel + (x.how ? '   [' + x.how + ']' : '')); };
out('Изменён только движок (перенесутся по --apply)', R.engine);
out('Изменён только шаблон (не переносятся: «обнови протокол Форма»)', R.template);
out('Конфликт: изменены оба (решает человек)', R.conflict);
out('Отличаются только исключениями (обезличивание, не дрейф)', R.same);
out('Новые в движке (только по --add <путь>)', R.fresh);

if (mark) {
  const dirty = R.engine.length + R.template.length + R.conflict.length;
  if (dirty) { console.error('\nСТОП --mark: движок и шаблон расходятся в ' + dirty + ' файлах — база была бы ложной.'); process.exit(1); }
  if (git('status', '--porcelain', '--', FORMA_GIT).trim()) { console.error('\nСТОП --mark: в шаблоне незакоммиченное — сначала коммит в protocol/.'); process.exit(1); }
  const head = git('rev-parse', 'HEAD').trim();
  fs.writeFileSync(baseFile, head + '\n');
  console.log('\nБаза записана: ' + head);
  process.exit(0);
}

const forbiddenAdds = adds.filter(forbidden);
if (forbiddenAdds.length) {
  console.error('СТОП: --add отказан для продуктовых зон и слоя 4 (project/, .devtool/, .forma/living/, записи .claude/project-layer.txt): ' + forbiddenAdds.join(', '));
  process.exit(1);
}
const bad = adds.filter((a) => !R.fresh.some((x) => x.rel === a));
if (bad.length) { console.error('СТОП: --add не из списка новых: ' + bad.join(', ')); process.exit(1); }
if (!apply) { console.log('\nНичего не записано. Перенести: --apply' + (R.fresh.length ? ' [--add <путь>]' : '') + '.'); process.exit(0); }

// перенос: содержимое движка, но маскированные строки берутся из шаблона (обезличивание не утекает)
function merge(x) {
  const rs = MASK[x.rel];
  if (!rs) return norm(x.eRaw);
  const tl = norm(x.hRaw).split('\n').filter((l) => rs.some((r) => r.test(l)));
  const el = norm(x.eRaw).split('\n');
  if (el.filter((l) => rs.some((r) => r.test(l))).length !== tl.length) return null;
  let i = 0;
  return el.map((l) => (rs.some((r) => r.test(l)) ? tl[i++] : l)).join('\n');
}
let n = 0;
for (const x of R.engine) {
  const c = merge(x);
  if (c == null) { console.error('ПРОПУЩЕН ' + x.rel + ': число строк-исключений в движке и шаблоне разное.'); continue; }
  fs.writeFileSync(x.dst, x.hRaw.includes('\r\n') ? c.replace(/\n/g, '\r\n') : c); n++;
}
for (const x of R.fresh.filter((x) => adds.includes(x.rel))) { fs.mkdirSync(path.dirname(x.dst), { recursive: true }); fs.copyFileSync(x.src, x.dst); n++; }
console.log(`\nПеренесено: ${n}. Дальше: patch в protocol/.claude-plugin/plugin.json, коммит в protocol/, --mark, pull --rebase, --before-push, push — по команде человека.`);
