#!/usr/bin/env node
// Коммит движка без дрейфа: Claude → Gemini/Codex → исходник протокола → коммиты.
// Для автора протокола, в любом проекте, где protocol/ — git-клон IamForma/forma. Запуск из корня проекта.
//   node .forma/protocol/scripts/forma-commit.cjs "сообщение"          — синхронизировать, проверить, закоммитить
//   ... --check                                                   — только проверить, ничего не пишет (для pre-commit)
//   ... --release                                                 — выпуск сейчас: dev → main, версия +1, push main и dev
//   ... --push                                                    — отправить dev (версия не меняется) и проект, если у него есть remote
// Коммиты протокола идут в ветку dev без версии; набралось N (PROJECT.md, «Выпуск протокола») — выпуск сам.
//   ... --sync-staged                                             — проверка ядра и адаптеров перед коммитом (его зовёт pre-commit); роли между движками не копируются
//   ... --install-hook                                            — поставить .git/hooks/pre-commit (любой запуск ставит его сам)
//
// Порядок: sync-engines --check (ядро + адаптеры по тесту соответствия; роли между движками не копируются) →
// engine-to-protocol --apply (core/, adapters/claude/, adapters/codex/, adapters/gemini/) →
// коммит protocol/ в dev + --mark → коммит проекта (git add -A, со ссылкой на новый HEAD protocol/).
// Стоп на конфликте или «изменён только шаблон»: это решает человек («обнови протокол Форма»).
'use strict';
const fs = require('fs');
const path = require('path');
const { walk: walkTree, projectFile } = require('../skills/forma/core/dashboard/lib/fs.cjs');
const { run, gitRun } = require('./lib/git.cjs');
const { scanTraces, scanMessages } = require('./check-release.cjs');

const root = process.cwd();
const proto = path.join(root, '.forma/protocol');
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const msg = args.find((a) => !a.startsWith('--'));
// В протокол уходит чистое сообщение: ведущая отметка карточки проекта («Карточка NNN: …») отбрасывается,
// в коммите проекта она остаётся. Любой другой след в сообщении — стоп.
const protoMsg = msg ? msg.replace(/^\s*(?:карточк\p{L}*|card)[\s-]*\d{2,3}\s*[:—-]\s*/iu, '') : '';
const CO = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';

const node = (script, ...a) => run('node', [script, ...a]);
const git = (...a) => gitRun(root, ...a);
const pgit = (...a) => gitRun(proto, ...a);
const stop = (m, code = 1) => { console.error('СТОП: ' + m); process.exit(code); };
const ok = (m) => console.log('✓ ' + m);

if (!fs.existsSync(path.join(proto, '.git'))) stop('protocol/.git нет — это не клон IamForma/forma.', 2);

// Выпуск по объёму: коммиты копятся в `dev`, версия поднимается раз на выпуск.
// N — PROJECT.md, строка «Выпуск протокола»; нет строки — 10.
const RELEASE_N = (() => {
  try { const m = fs.readFileSync(projectFile(root, 'PROJECT.md'), 'utf8').match(/Выпуск протокола[^\n]*?(\d+)\s*$/m); if (m) return +m[1]; } catch { /* нет PROJECT.md или строки выпуска — берём умолчание ниже */ }
  return 10;
})();
const hasDev = () => !!pgit('rev-parse', '--verify', '-q', 'refs/heads/dev').out.trim();
const pending = () => hasDev()
  ? pgit('log', '--no-merges', '--format=%s', 'main..dev').out.split(/\r?\n/).filter(Boolean) : [];
function onDev() {
  if (pgit('rev-parse', '--abbrev-ref', 'HEAD').out.trim() === 'dev') return;
  const r = hasDev() ? pgit('checkout', '-q', 'dev') : pgit('checkout', '-q', '-b', 'dev');
  if (r.code) stop('protocol/: не перейти на dev:\n' + r.out);
}
function stopTraces(files, msgs) {
  const lines = files.slice(0, 40).map((b) => `  ${b.file}:${b.line} [${b.why}] ${b.text}`)
    .concat(msgs.map((b) => `  сообщение «${b.message}» [${b.why}]`));
  stop('в протоколе следы проекта (запрет 16) — в клон идёт только чистый код:\n' + lines.join('\n'));
}
function release() {
  const list = pending();
  const dirty = scanMessages(list);
  if (dirty.length) stopTraces([], dirty);
  if (!list.length) { ok('выпуск: в dev нет новых коммитов'); return; }
  if (pgit('status', '--porcelain').out.trim()) stop('выпуск: в protocol/ незакоммиченное.');
  // Проверка перед выпуском: следы порчи переезда, тесты, линтер. Красное — выпуска нет, ничего не слито и не отправлено.
  const chk = run('node', [path.join(proto, 'scripts', 'check-release.cjs')]);
  if (chk.code) stop('выпуск остановлен проверкой перед выпуском:\n' + chk.out);
  ok('проверка перед выпуском пройдена');
  pgit('fetch', '-q', 'origin');
  let r = pgit('checkout', '-q', 'main');
  if (r.code) stop('выпуск: не перейти на main:\n' + r.out);
  r = pgit('merge', '--ff-only', '-q', 'origin/main');
  if (r.code) { pgit('checkout', '-q', 'dev'); stop('выпуск: origin/main разошёлся с main — решает человек:\n' + r.out); }
  r = pgit('merge', '--no-ff', '--no-commit', 'dev');
  if (r.code) { pgit('merge', '--abort'); pgit('checkout', '-q', 'dev'); stop('выпуск: конфликт dev → main:\n' + r.out); }
  const pj = path.join(proto, '.claude-plugin', 'plugin.json');
  const j = fs.readFileSync(pj, 'utf8');
  const v = JSON.parse(j).version, m = v.match(/^(\d+)\.(\d+)\.(\d+)(-[\w.]+)?$/);
  if (!m) stop('выпуск: версия «' + v + '» не вида X.Y.Z[-метка].');
  const nv = `${m[1]}.${m[2]}.${+m[3] + 1}${m[4] || ''}`; // метка стадии (-alpha) переносится как есть
  fs.writeFileSync(pj, j.replace(`"version": "${v}"`, `"version": "${nv}"`));
  const pk = path.join(proto, 'package.json'); // package.json держит ту же версию, что plugin.json
  const pkj = fs.readFileSync(pk, 'utf8');
  fs.writeFileSync(pk, pkj.replace(/"version": "[^"]*"/, `"version": "${nv}"`));
  pgit('add', '-A');
  r = pgit('commit', '-q', '-m', `v${nv} — ${list.length} коммит(ов)\n\n${list.reverse().map((s) => '- ' + s).join('\n')}\n\n${CO}`);
  if (r.code) stop('выпуск: коммит слияния не прошёл:\n' + r.out);
  ok(`protocol/ выпуск: ${v} → ${nv}, коммитов ${list.length}`);
  const bp = node(E2P, '--before-push');
  if (bp.code) stop(bp.out);
  r = pgit('push', '-q', 'origin', 'main');
  if (r.code) stop('push protocol/ main не прошёл:\n' + r.out);
  pgit('checkout', '-q', 'dev');
  r = pgit('merge', '--ff-only', '-q', 'main');
  if (r.code) stop('dev не догнал main:\n' + r.out);
  r = pgit('push', '-q', '-u', 'origin', 'dev');
  if (r.code) stop('push protocol/ dev не прошёл:\n' + r.out);
  const mk = node(E2P, '--mark');
  if (mk.code) console.error('! --mark не записал базу (движок и шаблон расходятся) — следующая сверка покажет ложные конфликты:\n' + mk.out);
  ok('protocol/ отправлен: main и dev');
  git('add', '.forma/protocol');
  if (git('diff', '--cached', '--quiet').code) git('commit', '-q', '-m', `Выпуск протокола v${nv}: ${list.length} коммит(ов)\n\n${CO}`);
}
const ENG = '.claude/scripts/sync-engines.cjs';
const CDX = '.codex/scripts/sync-codex.cjs';
const E2P = '.forma/protocol/scripts/engine-to-protocol.cjs';

// pre-commit проекта: любой коммит, и обычный git commit, переносит Claude → Gemini/Codex
// и берёт их файлы в тот же коммит. Перенос в исходник протокола и версия — по-прежнему forma-commit.
const HOOK = path.join(root, '.git', 'hooks', 'pre-commit');
const HOOK_BODY = '#!/bin/sh\n# forma: проверка ядра и адаптеров перед коммитом (forma-commit.cjs)\nexec node .forma/protocol/scripts/forma-commit.cjs --sync-staged\n';
function installHook() {
  fs.writeFileSync(HOOK, HOOK_BODY);
  try { fs.chmodSync(HOOK, 0o755); } catch { /* ФС без chmod (Windows) — git запустит хук и так */ }
}
if (has('--install-hook')) { installHook(); ok('pre-commit поставлен: ' + path.relative(root, HOOK)); process.exit(0); }
try { if (fs.readFileSync(HOOK, 'utf8') !== HOOK_BODY) throw 0; } catch { installHook(); ok('pre-commit поставлен: проверка ядра и адаптеров на каждом коммите'); }

// Хуки клона протокола: коммит и пуш со следами проекта (коды карточек, даты, имена сайтов) невозможны и мимо forma-commit.
const PROTO_HOOKS = {
  'pre-commit': 'node scripts/check-release.cjs --traces',
  'commit-msg': 'node scripts/check-release.cjs --message "$1"',
  'pre-push': 'node scripts/check-release.cjs --prepush',
};
for (const [name, cmd] of Object.entries(PROTO_HOOKS)) {
  const f = path.join(proto, '.git', 'hooks', name);
  const body = `#!/bin/sh\n# forma: чистый протокол — проверка следов проекта (check-release.cjs)\nexec ${cmd}\n`;
  try { if (fs.readFileSync(f, 'utf8') === body) continue; } catch { /* хука нет */ }
  try { fs.writeFileSync(f, body); fs.chmodSync(f, 0o755); } catch { /* ФС без chmod — git запустит хук и так */ }
}

// Паритет движков. Незакрытые Core карточки — не дрейф движка: предупреждение, не стоп.
// tpl=false: расхождение .codex/ с шаблоном протокола — не дрейф между движками, его переносит шаг 2
// (engine-to-protocol). Проверять его до шага 2 значит останавливать каждую правку .codex/.
// Коммит сверяет только ядро и адаптер Claude; Codex и Gemini — ручной sync-engines --check перед выпуском.
const OTHER = /\.codex\/|\.agents\/|GEMINI\.md|adapters\/(codex|gemini)\/|CODEX-8|gemini-8|\bCodex\b|\bGemini\b/i;
function parity(tpl = true) {
  const bad = [];
  if (fs.existsSync(ENG)) {
    const out = node(ENG, '--check').out.split(/\r?\n/);
    let cards = false;
    for (const l of out) {
      if (/^\s{4}— /.test(l)) { cards = /не закрыты `Core`/.test(l); if (!cards && (tpl || !OTHER.test(l))) bad.push(l.trim()); }
      if (cards && /не закрыты `Core`/.test(l)) console.log('! ' + l.trim().replace(/^— /, '') + ' — дело Core, коммит не держит');
    }
  }
  // Codex — адаптер «не готов»: его сверка — сведение, коммит не держит.
  if (tpl && fs.existsSync(CDX)) { const r = node(CDX, '--check'); if (r.code) console.log('! адаптер Codex (не готов) расходится со своей сверкой — сведение, коммит не держит'); }
  return bad;
}
// Движок против исходника протокола
function e2p() {
  const out = node(E2P).out;
  const n = (t) => +((out.match(new RegExp(t + '[^:]*: (\\d+)')) || [])[1] || 0);
  return { out, engine: n('Изменён только движок'), template: n('Изменён только шаблон'), conflict: n('Конфликт') };
}

// Файлы протокола проекта против их пар в шаблоне. Предупреждение, не стоп; CRLF → LF.
const CORE = path.join(proto, 'skills', 'forma', 'core'), CLA = path.join(proto, 'skills', 'forma', 'adapters', 'claude');
function templateDrift() {
  const pairs = [];
  const walk = (d) => walkTree(d, { symlinks: true, abs: true });
  const tree = (src, base, dst) => { for (const f of walk(path.join(root, src))) pairs.push([f, path.join(base, dst, path.relative(path.join(root, src), f))]); };
  pairs.push([path.join(root, 'AGENTS.md'), path.join(CORE, 'AGENTS.md')]);
  tree('.claude/agents', CLA, 'agents');
  pairs.push([path.join(root, '.claude/rules/claude-8.md'), path.join(CLA, 'rules/claude-8.md')]);
  for (const f of walk(path.join(CLA, 'scripts')).filter((f) => f.endsWith('.cjs'))) pairs.push([path.join(root, '.claude/scripts', path.relative(path.join(CLA, 'scripts'), f)), f]);
  tree('manual', CORE, 'manual');
  for (const f of ['generate.js', 'index.html', 'economy.cjs', 'tally.cjs', 'spend-line.cjs']) pairs.push([path.join(root, 'dashboard', f), path.join(CORE, 'dashboard', f)]);
  tree('dashboard/web', CORE, 'dashboard/web');
  const rd = (f) => { try { return fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n'); } catch { return null; } };
  return pairs.filter(([a, b]) => { const x = rd(a), y = rd(b); return x !== null && x !== y; })
    .map(([a]) => path.relative(root, a).replace(/\\/g, '/'));
}

if (has('--sync-staged')) {
  // Роли между движками не копируются: каждый движок держит свой адаптер. Здесь только проверка.
  const bad = parity(false);
  if (bad.length) { console.error('Ядро или адаптер не сходится, коммит остановлен:\n  ' + bad.join('\n  ')); process.exit(1); }
  const tdiff = templateDrift();
  if (tdiff.length) console.log('! шаблон protocol/skills/forma/ отстаёт от проекта: ' + tdiff.join(', ') + ' — коммит не держит');
  process.exit(0);
}

if (has('--check')) {
  const bad = parity(), s = e2p();
  if (s.engine) bad.push(`движок впереди протокола в ${s.engine} файлах — node .forma/protocol/scripts/forma-commit.cjs "…"`);
  if (s.template || s.conflict) bad.push(`протокол впереди движка или конфликт (${s.template}/${s.conflict}) — node ${E2P}`);
  if (bad.length) { console.error('Дрейф движков, коммит остановлен:\n  ' + bad.join('\n  ')); process.exit(1); }
  ok('дрейфа нет');
  process.exit(0);
}

// --push без сообщения — только отправка уже сделанных коммитов.
if (!msg && !has('--push') && !has('--release')) stop('нужно сообщение коммита: node .forma/protocol/scripts/forma-commit.cjs "что сделано"', 2);
if (msg) {

// 1. ядро + адаптеры по тесту соответствия (роли между движками не копируются)
const bad = parity(false);
if (bad.length) stop('ядро или адаптер не сходится, дочинить руками:\n  ' + bad.join('\n  '));
ok('ядро цельно, адаптеры прошли тест соответствия');

// 2. движок → исходник протокола
let s = e2p();
if (s.template || s.conflict) stop(`в протоколе есть правки, которых нет в движке (${s.template} шаблон, ${s.conflict} конфликт):\n` + s.out);
if (s.engine) {
  const r = node(E2P, '--apply');
  if (/ПРОПУЩЕН/.test(r.out)) stop('часть файлов не перенесена:\n' + r.out);
  ok(`перенесено в протокол: ${s.engine}`);
}
const fresh = (s.out.split('Новые в движке')[1] || '').split(/\r?\n/).slice(1).filter((l) => /^\s{2}\S/.test(l)).map((l) => l.trim());
if (fresh.length) console.log('! новые файлы движка не переносятся сами (решение — --add): ' + fresh.join(', '));

// 3. коммит протокола в `dev` без версии; версия — только на выпуске
if (pgit('status', '--porcelain').out.trim()) {
  onDev();
  pgit('add', '-A');
  const ft = scanTraces(proto), mt = scanMessages([protoMsg]);
  if (ft.length || mt.length) { pgit('reset', '-q'); stopTraces(ft, mt); }
  const c = pgit('commit', '-q', '-m', `${protoMsg}\n\nПеренесено из движка forma-commit.cjs.\n\n${CO}`);
  if (c.code) stop('коммит protocol/ не прошёл:\n' + c.out);
  node(E2P, '--mark');
  ok(`protocol/ dev: в выпуске ${pending().length}/${RELEASE_N}`);
}

// 4. коммит проекта — всё, включая ссылку на protocol/
git('add', '-A');
if (git('diff', '--cached', '--quiet').code) {
  const c = git('commit', '-q', '-m', `${msg}\n\n${CO}`);
  if (c.code) stop('коммит проекта не прошёл:\n' + c.out);
  ok('проект: ' + git('log', '--oneline', '-1').out.trim());
} else ok('проект: изменений нет');
}

// 5. выпуск: набрано N коммитов в `dev`, или --release (закрытие круга, команда человека).
//    dev → main одним merge, один подъём patch, push main и dev. --push без выпуска — только dev.
if (has('--release') || pending().length >= RELEASE_N) release();
else if (has('--push') && pgit('rev-parse', '--verify', '-q', 'dev').out.trim()) {
  const ps = pgit('push', '-q', '-u', 'origin', 'dev');
  if (ps.code) stop('push protocol/ dev не прошёл:\n' + ps.out);
  ok(`protocol/ dev отправлен (в выпуске ${pending().length}/${RELEASE_N}, версия не менялась)`);
}
if (has('--push') || has('--release')) {
  if (git('remote').out.trim()) {
    const ps = git('push', '-q');
    if (ps.code) stop('push проекта не прошёл:\n' + ps.out);
    ok('проект отправлен');
  } else ok('проект: remote нет — только локальный коммит');
}

// 6. отчёт: счёт круга по эпикам и незапушенные коммиты. Push — на закрытии круга `Core`
//    или по команде человека, не на каждой карточке (AGENTS.md §7).
const CYC = '.claude/scripts/cycle-status.cjs';
if (fs.existsSync(path.join(root, CYC))) { const r = node(CYC); if (r.out.trim()) console.log('! ' + r.out.trim()); }
