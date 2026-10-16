// Движок переименования эпиков: план (содержимое + каталоги), запись с журналом, откат, самопроверка на ловушках.
// Общий для epics-rename.cjs (проект) и epics-migrate-install.cjs (установленные проекты). Ничего не знает о проекте:
// корень, карта и журнал приходят аргументами.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const lib = require('./epics-lib.cjs');

const MAX_SIZE = 2_000_000;

const sha = (b) => crypto.createHash('sha1').update(b).digest('hex');
const posix = (p) => p.split(path.sep).join('/');
const waves = (layer) => String(layer.wave || '').split('/').filter(Boolean);
const isSel = (sel, layer) => !sel || sel.has(layer.id) || waves(layer).some((w) => sel.has(w));

const { git, listFiles, TEXT, NESTED } = lib;

// ---------- git mv с учётом вложенного репозитория ----------
function repoFor(root, rel) {
  for (const n of NESTED) if ((rel === n || rel.startsWith(n + '/')) && fs.existsSync(path.join(root, n, '.git'))) return { cwd: path.join(root, n), rel: rel === n ? '.' : rel.slice(n.length + 1) };
  return { cwd: root, rel };
}
function move(root, from, to) {
  const a = repoFor(root, from), b = repoFor(root, to);
  fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
  if (a.cwd === b.cwd) {
    try { git(a.cwd, ['mv', a.rel, b.rel]); return 'git mv'; } catch { /* не под git (untracked) — обычное переименование */ }
  }
  fs.renameSync(path.join(root, from), path.join(root, to));
  return 'fs.rename';
}

// ---------- расширение путей карты ----------
function expandMoves(map) {
  const res = [];
  for (const t of map.paths.templates) {
    for (const k of map.kinds) {
      for (const lang of t.langs || [null]) {
        const sub = (s) => s.split('%LANG%').join(lang || '').split('%N%').join(String(k.n)).split('%OLD%').join(k.old.code).split('%NEW%').join(k.new.code);
        res.push({ from: sub(t.from), to: sub(t.to), wave: t.wave, kind: k.n });
      }
    }
  }
  return res;
}

// ---------- грязное дерево ----------
function dirtyPaths(root) {
  const out = new Set();
  const take = (cwd, prefix) => {
    let raw; try { raw = git(cwd, ['status', '--porcelain', '-z', '--untracked-files=all']); } catch { return; }
    const e = raw.split('\0');
    for (let i = 0; i < e.length; i++) {
      if (e[i].length < 4) continue;
      out.add(prefix + e[i].slice(3));
      if (/^[RC]/.test(e[i])) i++; // следующая запись — прежний путь
    }
  };
  take(root, '');
  for (const n of NESTED) if (fs.existsSync(path.join(root, n, '.git'))) take(path.join(root, n), n + '/');
  return out;
}

// ---------- план ----------
function buildPlan(root, map, rules, sel) {
  const plan = { changes: [], moves: [], skippedLayers: {}, notSelected: {}, perRule: {}, perLayer: {}, confirms: [], problems: [], notes: [], scanned: 0 };
  const bad = (m) => plan.problems.push(m);
  for (const rel of listFiles(root)) {
    if (!TEXT.test(rel)) continue;
    const layer = lib.layerOf(map, rel);
    if (layer.mode !== 'auto') { plan.skippedLayers[layer.id] = (plan.skippedLayers[layer.id] || 0) + 1; continue; }
    if (!isSel(sel, layer)) { plan.notSelected[layer.id] = (plan.notSelected[layer.id] || 0) + 1; continue; }
    const abs = path.join(root, rel);
    let st; try { st = fs.statSync(abs); } catch { continue; }
    if (st.size > MAX_SIZE) { plan.notes.push('пропущен (>2 МБ): ' + rel); continue; }
    const buf = fs.readFileSync(abs);
    if (buf.includes(0)) continue;
    const text = buf.toString('utf8');
    if (!Buffer.from(text, 'utf8').equals(buf)) { plan.notes.push('пропущен (не utf8): ' + rel); continue; }
    plan.scanned++;
    const r = lib.applyText(rules, text, { rel, layerId: layer.id });
    const n = Object.values(r.counts).reduce((a, b) => a + b, 0);
    if (!n) continue;
    if (r.out.split('\n').length !== text.split('\n').length) { bad('число строк изменилось: ' + rel); continue; }
    if (/\.json$/i.test(rel)) {
      let was = true; try { JSON.parse(text.replace(/^﻿/, '')); } catch { was = false; }
      if (was) { try { JSON.parse(r.out.replace(/^﻿/, '')); } catch { bad('JSON сломан: ' + rel); continue; } }
    }
    if (lib.applyText(rules, r.out, { rel, layerId: layer.id }).out !== r.out) { bad('не идемпотентно: ' + rel); continue; }
    plan.changes.push({ rel, layer: layer.id, n, counts: r.counts, before: sha(buf), out: r.out });
    plan.perLayer[layer.id] = (plan.perLayer[layer.id] || 0) + n;
    for (const [id, c] of Object.entries(r.counts)) plan.perRule[id] = (plan.perRule[id] || 0) + c;
    r.confirms.forEach((c) => plan.confirms.push({ file: rel, ...c }));
  }
  // каталоги
  const all = expandMoves(map);
  const present = all.filter((m) => fs.existsSync(path.join(root, m.from)));
  plan.movesExpected = map.paths.expectedCount;
  plan.movesPresent = present.length;
  for (const m of present) {
    const layer = lib.layerOf(map, m.from + '/');
    if (layer.mode !== 'auto') continue;
    if (!isSel(sel, layer)) continue;
    if (fs.existsSync(path.join(root, m.to))) { bad('цель каталога уже существует: ' + m.to); continue; }
    plan.moves.push({ from: m.from, to: m.to, layer: layer.id });
  }
  return plan;
}

// ---------- apply / rollback ----------
function applyPlan(root, plan, jdir, extra) {
  fs.mkdirSync(path.join(jdir, 'orig'), { recursive: true });
  let head = '', branch = '';
  try { head = git(root, ['rev-parse', '--short', 'HEAD']).trim(); branch = git(root, ['branch', '--show-current']).trim(); } catch { /* вне git */ }
  const journal = { version: 1, created: new Date().toISOString(), root, head, branch, only: extra.only, status: 'running', files: [], moves: [] };
  const save = () => fs.writeFileSync(path.join(jdir, 'journal.json'), JSON.stringify(journal, null, 1));
  save();
  for (const c of plan.changes) {
    const abs = path.join(root, c.rel);
    const orig = fs.readFileSync(abs);
    if (sha(orig) !== c.before) throw new Error('файл изменился между планом и записью: ' + c.rel);
    const bak = path.join(jdir, 'orig', c.rel);
    fs.mkdirSync(path.dirname(bak), { recursive: true });
    fs.writeFileSync(bak, orig);
    const buf = Buffer.from(c.out, 'utf8');
    fs.writeFileSync(abs, buf);
    journal.files.push({ rel: c.rel, before: c.before, after: sha(buf), n: c.n });
  }
  save();
  if (!extra.noMoves) {
    for (const m of plan.moves) { journal.moves.push({ from: m.from, to: m.to, how: move(root, m.from, m.to) }); save(); }
  }
  journal.status = 'done';
  save();
  return journal;
}

function rollback(root, jdir, force) {
  const j = JSON.parse(fs.readFileSync(path.join(jdir, 'journal.json'), 'utf8'));
  const problems = [];
  if (j.status === 'rolled-back') return { problems: ['журнал уже откачен'], files: 0, moves: 0 };
  let nm = 0, nf = 0;
  for (const m of [...j.moves].reverse()) {
    if (fs.existsSync(path.join(root, m.to)) && !fs.existsSync(path.join(root, m.from))) { move(root, m.to, m.from); nm++; }
    else problems.push('каталог не откачен (нет цели или занят прежний путь): ' + m.to);
  }
  for (const f of j.files) {
    const abs = path.join(root, f.rel);
    let cur; try { cur = sha(fs.readFileSync(abs)); } catch { problems.push('файла нет: ' + f.rel); continue; }
    if (cur !== f.after && !force) { problems.push('изменён после записи, пропущен (--force): ' + f.rel); continue; }
    fs.writeFileSync(abs, fs.readFileSync(path.join(jdir, 'orig', f.rel)));
    nf++;
  }
  if (!problems.length) { j.status = 'rolled-back'; fs.writeFileSync(path.join(jdir, 'journal.json'), JSON.stringify(j, null, 1)); }
  return { problems, files: nf, moves: nm };
}

// ---------- самопроверка ----------
function traps(map, rules) {
  const bad = [];
  map.tests.forEach((t, i) => {
    const r = lib.applyText(rules, t.in, { rel: t.rel || 'test.md', layerId: 'other' });
    if (r.out !== t.out) bad.push('ловушка ' + i + ': ' + JSON.stringify({ in: t.in, expected: t.out, got: r.out }));
    else if (lib.applyText(rules, r.out, { rel: t.rel || 'test.md', layerId: 'other' }).out !== r.out) bad.push('ловушка ' + i + ': не идемпотентна');
  });
  return bad;
}

function fixtureTest(map, rules) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'epics-rename-'));
  const put = (rel, text) => { const a = path.join(tmp, rel); fs.mkdirSync(path.dirname(a), { recursive: true }); fs.writeFileSync(a, text, 'utf8'); };
  const keep = {
    '.claude/agents/core.md': 'Core — узел; Ядро — слой движка; «Экономика» — вкладка; Форма записи и протокол «Форма»; плагин `forma`; .forma/protocol и .forma/manual.\n',
    'AGENTS.md': 'Опыт хранится в project/experience/; Входящие письма; goal-formal, 03-formal, end-result-image; card-006-goal-forma-label.md\n',
    'project/cards/card-005/archive.md': 'goal-forma и «3. Форма/Intent+Kit» — архив, не трогаем\n',
    '.codex/CODEX-8.md': 'goal-forma — зона другого движка, позже\n',
  };
  const change = {
    '.devtool/features/card-009-x.md': { in: 'epic: "6. Входящие"\nlabels: ["goal-incoming", "route-1"]\n', out: 'epic: "6. Обсуждение дел"\nlabels: ["goal-discussion", "route-1"]\n' },
    'project/goals/goal-forma/GOAL.md': { in: '# goal-forma\nТекст «Форма» остаётся.\n', out: '# goal-protocol\nТекст «Форма» остаётся.\n' },
    '.forma/manual/ru/03-forma/README.md': { in: 'Раздел 03-forma, протокол «Форма», `.forma/`.\n', out: 'Раздел 03-protocol, протокол «Форма», `.forma/`.\n' },
  };
  try {
    for (const [r, t] of Object.entries(keep)) put(r, t);
    for (const [r, c] of Object.entries(change)) put(r, c.in);
    try { git(tmp, ['init', '-q']); git(tmp, ['add', '-A']); } catch { /* без git — обычное переименование */ }
    const snap = () => { const o = {}; for (const f of listFiles(tmp)) o[f] = sha(fs.readFileSync(path.join(tmp, f))); return o; };
    const before = snap();
    const fails = [];
    // dry
    const plan = buildPlan(tmp, map, rules, null);
    plan.problems.forEach((p) => fails.push('dry: ' + p));
    const got = plan.changes.map((c) => c.rel).sort().join(',');
    const want = Object.keys(change).sort().join(',');
    if (got !== want) fails.push('dry: изменяемые файлы ' + got + ' ≠ ожидаемых ' + want);
    for (const c of plan.changes) if (change[c.rel] && c.out !== change[c.rel].out) fails.push('dry: ' + c.rel + ' → ' + JSON.stringify(c.out));
    if (plan.moves.length !== 2) fails.push('dry: каталогов ' + plan.moves.length + ' вместо 2');
    if (JSON.stringify(snap()) !== JSON.stringify(before)) fails.push('dry изменил файлы');
    // apply → откат
    const jdir = path.join(tmp, '_journal');
    applyPlan(tmp, plan, jdir, { only: null, noMoves: false });
    for (const [r, c] of Object.entries(change)) {
      const moved = r.replace('goal-forma', 'goal-protocol').replace('03-forma', '03-protocol');
      const f = path.join(tmp, moved);
      if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== c.out) fails.push('apply: ' + moved);
    }
    for (const [r, t] of Object.entries(keep)) if (fs.readFileSync(path.join(tmp, r), 'utf8') !== t) fails.push('apply повредил ловушку ' + r);
    const rb = rollback(tmp, jdir, false);
    rb.problems.forEach((p) => fails.push('откат: ' + p));
    const after = snap();
    for (const k of Object.keys(before)) if (after[k] !== before[k]) fails.push('после отката отличается ' + k);
    if (Object.keys(after).filter((k) => !k.startsWith('_journal/')).length !== Object.keys(before).length) fails.push('после отката другое число файлов');
    return fails;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = { MAX_SIZE, sha, posix, waves, isSel, repoFor, move, expandMoves, dirtyPaths, buildPlan, applyPlan, rollback, traps, fixtureTest };
