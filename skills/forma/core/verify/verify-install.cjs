#!/usr/bin/env node
'use strict';

// Целостность установки «Формы»: установлено ли всё, что ставил установщик, и связано ли между собой.
//   node .forma/verify/verify-install.cjs [--root <папка>] [--json] [--skip-behavior]
// Выход 0 — всё сходится (у второстепенных движков допустимы предупреждения); 1 — красное у главного движка.
//
// Три слоя, каждое расхождение — «адрес — ожидалось — найдено» (запрет 13 AGENTS.md):
//   1. Опись — `.forma/install-manifest.json`: sha256 файлов, которые записал установщик; для зон человека
//      (`project/`) — скелет (число заголовков), не хэш: человек наполняет их по делу.
//   2. Замыкание — каждый .cjs разбирается, каждый .json читается; профиль движка проверяет проводку
//      (хуки ↔ файлы ↔ settings, роли, ссылки по голому имени).
//   3. Поведение — профиль движка запускает стартовые проверки (без вызова модели).
// Профиль движка лежит в адаптере и называется в описи (`engines[].profile`); ядро движков по имени не знает.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const MANIFEST = path.join('.forma', 'install-manifest.json');
const MANIFEST_VERSION = 1;

/** sha256 с нормализованными концами строк: перенос из git на Windows не должен давать красное. */
function sha256(file) {
  const buf = fs.readFileSync(file);
  const norm = buf.includes(13) ? Buffer.from(buf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1') : buf;
  return crypto.createHash('sha256').update(norm).digest('hex');
}

/** Скелет markdown: число заголовков `#` и `##` вне кодовых блоков. Не зависит от языка текста. */
function skeletonOf(text) {
  let fence = false, h1 = 0, h2 = 0;
  for (const line of text.split(/\r?\n/)) {
    if (/^(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    if (/^# /.test(line)) h1++;
    else if (/^## /.test(line)) h2++;
  }
  return { h1, h2 };
}

const rel = (root, abs) => path.relative(root, abs).split(path.sep).join('/');
const isHumanZone = (r) => /^(project|\.devtool)\//.test(r) || r.startsWith('.forma/living/') || r === '.gitignore'
  || r === '.forma/dashboard/graphify.config.json' || r === MANIFEST.split(path.sep).join('/');

/**
 * Опись установки. `owned` — абсолютные пути, записанные установщиком в этот проход.
 * Не `project/`-файлы получают хэш; `project/*.md` — скелет; остальное — только наличие.
 * `previous` — прежняя опись: скелет `project/` не пересчитывается, когда каталог уже был.
 */
function buildManifest(root, { owned, projectCreated, previous, engines, lang, version, template }) {
  const files = {};
  // конфигурация и служебные файлы переехали из project/ в project/config/ и project/ops/ — прежняя опись следует за файлами
  const moved = (k) => k.replace(/^project\/(PROJECT|CONFIG|SETUP|ROUTE|SITE)\.md$/, 'project/config/$1.md');
  const skeleton = projectCreated || !previous ? {} : Object.fromEntries(Object.entries(previous.skeleton || {}).map(([k, v]) => [moved(k), v]));
  for (const abs of owned) {
    if (!fs.existsSync(abs)) continue;
    const r = rel(root, abs);
    if (r.startsWith('project/')) {
      if (projectCreated) skeleton[r] = /\.md$/.test(r) ? skeletonOf(fs.readFileSync(abs, 'utf8')) : {};
    } else if (!isHumanZone(r)) files[r] = sha256(abs);
  }
  return {
    manifestVersion: MANIFEST_VERSION,
    version,
    lang,
    template: template || 'none',
    engines,
    dirs: ['project', '.forma/living', '.devtool/features'],
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
    skeleton: Object.fromEntries(Object.entries(skeleton).sort(([a], [b]) => a.localeCompare(b))),
  };
}

function readManifest(root) {
  const f = path.join(root, MANIFEST);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

/** Синтаксис .cjs без запуска: тело оборачивается, как это делает загрузчик CommonJS. */
function syntaxError(file) {
  const src = fs.readFileSync(file, 'utf8').replace(/^#!.*/, '');
  try { new vm.Script('(function (exports, require, module, __filename, __dirname) {' + src + '\n})', { filename: file }); return null; }
  catch (e) { return String(e.message).split('\n')[0]; }
}

const finding = (address, expected, found) => ({ address, expected, found });

/** Слой 1 + замыкание ядра: опись, хэши, скелет, синтаксис, JSON. */
function checkCore(root, manifest) {
  const out = [];
  if (!fs.existsSync(path.join(root, 'AGENTS.md'))) out.push(finding('AGENTS.md', 'корневой закон протокола', 'нет файла'));
  for (const d of manifest.dirs || []) {
    if (!fs.existsSync(path.join(root, d))) out.push(finding(d + '/', 'каталог есть', 'нет каталога'));
  }
  for (const [r, want] of Object.entries(manifest.files || {})) {
    const f = path.join(root, r);
    if (!fs.existsSync(f)) { out.push(finding(r, 'файл установщика', 'нет файла')); continue; }
    const got = sha256(f);
    if (got !== want) out.push(finding(r, 'sha256 ' + want.slice(0, 12) + '…', 'sha256 ' + got.slice(0, 12) + '… (файл изменён после установки)'));
    if (/\.cjs$/.test(r)) { const e = syntaxError(f); if (e) out.push(finding(r, 'разбирается как CommonJS', e)); }
    else if (/\.json$/.test(r)) { try { JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { out.push(finding(r, 'корректный JSON', e.message)); } }
  }
  for (const [r, want] of Object.entries(manifest.skeleton || {})) {
    const f = path.join(root, r);
    if (!fs.existsSync(f)) { out.push(finding(r, 'файл каркаса project/', 'нет файла')); continue; }
    if (!/\.md$/.test(r)) continue;
    const got = skeletonOf(fs.readFileSync(f, 'utf8'));
    if (got.h1 < want.h1) out.push(finding(r + ' — заголовки «#»', '≥ ' + want.h1, String(got.h1)));
    if (got.h2 < want.h2) out.push(finding(r + ' — заголовки «##»', '≥ ' + want.h2, String(got.h2)));
  }
  return out;
}

/** Профиль движка из описи: файл адаптера с `check(ctx)`. Нет файла — не установлен (для готового движка это красное). */
function loadProfile(root, engine) {
  if (!engine.profile) return { status: 'not-installed', why: engine.note || 'профиль сверки не заявлен — адаптер не готов' };
  const f = path.join(root, engine.profile);
  if (!fs.existsSync(f)) return { status: 'missing', file: engine.profile };
  try { return { status: 'ok', profile: require(f) }; }
  catch (e) { return { status: 'broken', file: engine.profile, why: e.message.split('\n')[0] }; }
}

/** Полная сверка. Возвращает { main, engines:[{id, role, notes, findings}], core, ok }. */
function verify(root, { behavior = true } = {}) {
  root = path.resolve(root);
  const result = { root, ok: true, core: [], engines: [] };
  let manifest;
  try { manifest = readManifest(root); }
  catch (e) { result.core.push(finding(MANIFEST.split(path.sep).join('/'), 'читаемый JSON', e.message)); result.ok = false; return result; }
  if (!manifest) {
    result.core.push(finding(MANIFEST.split(path.sep).join('/'), 'опись установки', 'нет файла — установка без описи; перезапустите установщик'));
    result.ok = false;
    return result;
  }
  result.manifest = { version: manifest.version, lang: manifest.lang, template: manifest.template };
  result.core = checkCore(root, manifest);
  if (result.core.length) result.ok = false;

  const engines = manifest.engines || [];
  engines.forEach((engine, i) => {
    const role = i === 0 ? 'main' : 'secondary';
    const row = { id: engine.id, role, notes: [], findings: [] };
    const loaded = loadProfile(root, engine);
    if (loaded.status === 'not-installed') row.notes.push('не установлен: ' + loaded.why);
    else if (loaded.status !== 'ok') row.findings.push(finding(loaded.file, 'профиль сверки движка', loaded.status === 'missing' ? 'нет файла' : loaded.why));
    else {
      const ctx = { root, engine, manifest, behavior, finding, syntaxError, mainFindings: result.engines[0] ? result.engines[0].findings : [] };
      try { row.findings.push(...loaded.profile.check(ctx)); }
      catch (e) { row.findings.push(finding(engine.profile, 'профиль отработал', e.message.split('\n')[0])); }
    }
    if (role === 'main' && row.findings.length) result.ok = false;
    result.engines.push(row);
  });
  if (!engines.length) { result.core.push(finding('install-manifest.json — engines', 'хотя бы один главный движок', 'список пуст')); result.ok = false; }
  return result;
}

/** Текстовый вид: OK или список «адрес — ожидалось — найдено». */
function format(result) {
  const lines = [];
  const row = (f) => `  — ${f.address} — ожидалось: ${f.expected} — найдено: ${f.found}`;
  for (const f of result.core) lines.push(row(f));
  for (const e of result.engines) {
    const tag = e.role === 'main' ? 'главный' : 'второстепенный';
    for (const n of e.notes) lines.push(`  · ${e.id} (${tag}): ${n}`);
    for (const f of e.findings) lines.push(e.role === 'main' ? row(f) : row(f).replace('  — ', '  ! предупреждение: '));
  }
  const head = result.ok ? '✓ установка целостна' : '✗ установка нарушена';
  return head + (lines.length ? '\n' + lines.join('\n') : '');
}

function main(argv) {
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const root = get('--root') || process.cwd();
  const result = verify(root, { behavior: !argv.includes('--skip-behavior') });
  if (argv.includes('--json')) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else process.stdout.write(format(result) + '\n');
  process.exit(result.ok ? 0 : 1);
}

module.exports = { MANIFEST, sha256, skeletonOf, buildManifest, readManifest, verify, format, syntaxError };
if (require.main === module) main(process.argv.slice(2));
