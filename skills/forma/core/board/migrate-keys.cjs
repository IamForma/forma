#!/usr/bin/env node
// Приводит карточки доски (открытые и закрытые) к английским ключам протокола, по словарю .forma/i18n/keys.json:
//   - заголовки зон: `## Задача` → `## Task` (Task, Kit, History, Result), якорь зоны не нужен;
//   - вид карточки в первом поле задачи: `дело | оснастка | решение` → `work | tooling | decision`;
//   - ключи «Снаряжения»: `Роль:` → `Role:`, `Скилл:` → `Skill:`, `Инструменты:` → `Tools:` …;
//   - глаголы истории: `закрыто —` → `closed —`, `заход,` → `attempt,`, `человек одобрил` → `human approved`, `Сервис,` → `Service,`.
// Тексты (значения, описания, строки истории после глагола) остаются на языке проекта.
//
//   node .forma/board/migrate-keys.cjs                  отчёт по каждой карточке (dry-run), ничего не пишет
//   node .forma/board/migrate-keys.cjs --apply          резервная копия карточки в project/cards/card-NNN/assets/, затем запись
//   node .forma/board/migrate-keys.cjs --card NNN       только эта карточка (повторяемо)
//
// Идемпотентно: у карточки без русских ключей ничего не меняется, копия существующую не затирает. После записи — проверка доски.
// Часть ядра: языка проекта не знает, всё берёт из словаря.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const i18n = require('../i18n/index.cjs');
const { cardFiles } = require('../dashboard/lib/card.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const L = i18n.KEYS.labels;
const ru = (key) => (L[key] || {}).ru || [];
const en = (key) => (L[key] || {}).en || [];
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ZONES = ['task', 'kit', 'history', 'result'];
const zoneOfHeading = (core) => ZONES.find((z) => i18n.headingRe('zone.' + z, '').test(core)) || null;

// Ключи «Снаряжения»: русский лейбл (с окончанием) → английский; множественное — по окончанию.
const KIT_KEYS = Object.keys(L).filter((k) => k.startsWith('kit.'));
const KIT_RU = KIT_KEYS.flatMap((k) => ru(k));
const KIT_RE = new RegExp('(^|[\\s·(;*>-])(' + KIT_RU.map(escapeRe).join('|') + ')(\\p{L}{0,3})(?=\\*{0,2}\\s*[:—–])', 'gu');
function kitEnglish(label, suffix) {
  const key = i18n.keyOf(label + suffix, 'kit');
  if (!key) return null;
  const word = en(key)[0];
  const plural = /^(ы|и|я)$/.test(suffix) && !/s$/.test(word);
  return plural ? word + 's' : word;
}

// Глаголы истории: [регулярка по строке, замена]; русская часть — лейблы словаря.
const NODE = '(- `[^`]+`, \\d{4}-\\d{2}-\\d{2}[^:\\n]*: )';
const VERBS = [
  [new RegExp('^' + NODE + '(?:' + ru('hist.closed').map(escapeRe).join('|') + ')(?= —)'), '$1' + en('hist.closed')[0]],
  [new RegExp('^' + NODE + '(?:' + ru('hist.attempt').map(escapeRe).join('|') + ')(?=[,\\s])'), '$1' + en('hist.attempt')[0]],
  [new RegExp('^' + NODE + escapeRe(ru('hist.approved')[0])), '$1' + en('hist.approved')[0]],
  [new RegExp('^' + NODE + escapeRe(ru('hist.approved')[1])), '$1' + en('hist.approved')[1]],
  [new RegExp('^- (?:' + ru('service').map(escapeRe).join('|') + ')(?=,\\s*\\d{4}-\\d{2}-\\d{2}:)'), '- ' + en('service')[0]],
];

/** Новый текст карточки и счётчики правок по видам. */
function migrate(text) {
  const n = { headings: 0, kind: 0, kit: 0, verbs: 0 };
  let zone = null, kindDone = false;
  const out = String(text).split('\n').map((raw) => {
    const cr = raw.endsWith('\r') ? '\r' : '';
    let line = cr ? raw.slice(0, -1) : raw;
    if (/^## /.test(line)) {
      const z = zoneOfHeading(line);
      zone = z;
      if (z) {
        const want = '## ' + en('zone.' + z)[0];
        if (line !== want) { line = want; n.headings++; }
      }
      return line + cr;
    }
    if (zone === 'task' && !kindDone && line.trim()) {
      kindDone = true;
      line = line.replace(/^(\d+\s*·\s*)([^\s|]+)(\s*\|)/, (m, a, kind, b) => {
        const key = i18n.keyOf(kind, 'kind');
        const word = key && en(key)[0];
        if (!word || word === kind) return m;
        n.kind++;
        return a + word + b;
      });
    } else if (zone === 'kit') {
      line = line.replace(KIT_RE, (m, pre, label, suffix) => {
        const w = kitEnglish(label, suffix);
        if (!w) return m;
        n.kit++;
        return pre + w;
      });
    } else if (zone === 'history') {
      for (const [re, to] of VERBS) {
        const next = line.replace(re, to);
        if (next !== line) { line = next; n.verbs++; break; }
      }
    }
    return line + cr;
  }).join('\n');
  return { text: out, counts: n, changed: out !== String(text) };
}

function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const only = argv.flatMap((a, i) => (a === '--card' ? [String(argv[i + 1]).replace(/^card-/, '').padStart(3, '0')] : []));
  const files = cardFiles(ROOT, /^card-\d+.*\.md$/).filter((f) => !only.length || only.includes(path.basename(f).match(/^card-(\d+)/)[1]));
  let changed = 0, totals = { headings: 0, kind: 0, kit: 0, verbs: 0 };
  const touched = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    const r = migrate(text);
    if (!r.changed) continue;
    changed++;
    for (const k of Object.keys(totals)) totals[k] += r.counts[k];
    const name = path.basename(f);
    console.log(`${name}: headings ${r.counts.headings}, kind ${r.counts.kind}, kit ${r.counts.kit}, verbs ${r.counts.verbs}`);
    if (!apply) continue;
    const num = name.match(/^card-(\d+)/)[1];
    const dir = path.join(ROOT, 'project', 'cards', 'card-' + num, 'assets');
    const backup = path.join(dir, `card-${num}.before-keys.md`);
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, text);
    fs.writeFileSync(f, r.text);
    touched.push(name.replace(/\.md$/, ''));
  }
  console.log(`${apply ? 'записано' : 'к записи (dry-run)'}: ${changed} из ${files.length} карточек; правок: заголовки ${totals.headings}, вид ${totals.kind}, ключи Снаряжения ${totals.kit}, глаголы истории ${totals.verbs}`);
  if (apply && touched.length) {
    let out = '';
    try { out = execFileSync(process.execPath, [path.join(__dirname, 'check-board.cjs')], { cwd: ROOT, encoding: 'utf8' }); } catch (e) { out = (e.stdout || '') + (e.stderr || ''); process.exitCode = 1; }
    const bad = out.split('\n').filter((l) => touched.some((c) => l.includes(c)));
    if (bad.length) { console.error(bad.join('\n')); process.exitCode = 1; } else console.log('check-board: по тронутым карточкам замечаний нет');
  }
}

if (require.main === module) main();
module.exports = { migrate };
