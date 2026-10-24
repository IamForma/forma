'use strict';

/**
 * Писатель строки расхода основной сессии движка MiniMax Code.
 *
 * Контракт — по `.claude/scripts/card-session-spend.cjs` и `.forma/manual/ru/03-protocol/ECONOMY.md`:
 *   N — полный расход вызова, ВКЛЮЧАЯ кэш-чтение: N = tokens_in + cache_write + cache_read + tokens_out;
 *   R — кэш-чтение; O — выход; T — активное время; id вызова — id сессии; тег — из адаптера (`spendTag`).
 *   Форматтер — общий: `.forma/dashboard/spend-line.cjs`.
 *
 * Отличия от версии Claude и почему:
 *   - Стенограмма рантайма MiniMax пишет ОДИН ответ API одной записью (`message_id` + `message.usage`),
 *     тогда как журнал Claude дублирует один ответ по блокам на каждый вызов инструмента. Поэтому
 *     дедупликация по `message_id` здесь — страховка, а не необходимость.
 *   - Сессии лежат в общем хранилище рантайма (`~/.minimax/v2/sessions`), а не в папке проекта:
 *     привязка к проекту идёт по тому, что путь карточки внутри сессии ведёт в корень этого проекта.
 *   - Материал карточки живёт в `project/cards/card-NNN/` (§6), поэтому он тоже считается касанием карточки.
 *
 * Одна сессия по одной карточке пишется несколькими строками — каждая только за новые ответы.
 * «Уже учтено» определяет граница окна: метка `граница <ISO>` в описании после тире
 * (`spend-line.cjs`, `sessionWindowEnd`). Повторный запуск берёт ответы строго после наибольшей границы.
 *
 * Запуск:
 *   node .minimax/scripts/card-session-spend.cjs <NNN>            # печатает строку
 *   node .minimax/scripts/card-session-spend.cjs <NNN> --write    # дописывает в `## История` карточки
 *   node .minimax/scripts/card-session-spend.cjs <NNN> --session <id> --idle 300 --from <ISO> --to <ISO>
 *
 * Без --write ничего не пишется: команда только считает и печатает.
 */

const fs = require('fs');
const path = require('path');
const { formatSpendLine, sessionWindowEnd } = require('../../.forma/dashboard/spend-line.cjs');
const reader = require('../../miniapps/minimax-engine/scripts/transcripts.cjs');
const adapter = require('../forma-adapter.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const IDLE_DEFAULT = 300;

// Путь карточки на доске и её материал (§6).
const CARD_PATH_RE = /[\\/]\.devtool[\\/]features[\\/](?:done[\\/])?card-(\d{3})-/;
const CARD_MATERIAL_RE = /[\\/]project[\\/]cards[\\/]card-(\d{3})[\\/]/;
// Признак записи в файл из командной строки.
const WRITE_CMD_RE = /(writeFileSync|appendFileSync|Set-Content|Out-File|Add-Content|>\s*['"]?[^|]*\.(md|cjs|json)|tee\b)/i;

const argv = process.argv.slice(2);
const flag = (name) => argv.includes('--' + name);
const opt = (name) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};

const CARD_ARG = (argv.find((a) => /^\d{3}$/.test(a)) || (argv.find((a) => /^card-\d{3}$/.test(a)) || '')).replace(/^card-/, '');
const MANUAL = !!(opt('from') || opt('to'));
const FROM = opt('from') ? Date.parse(opt('from')) : null;
const TO = opt('to') ? Date.parse(opt('to')) : null;
// Граница «уже учтено», заданная человеком: ответы строго после неё. Нужна, когда в карточке есть
// строка этой сессии без метки `граница` (старая форма) — иначе счёт задвоится.
const AFTER = opt('after') ? Date.parse(opt('after')) : null;
const IDLE = Number(opt('idle')) || IDLE_DEFAULT;
const ONLY_SESSION = opt('session');

const sp = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const hm = (ms) => new Date(ms).toISOString().slice(11, 16);

/** Файл карточки на доске: `.devtool/features/card-NNN-*.md`. */
function cardFile(num) {
  for (const dir of [path.join(ROOT, '.devtool', 'features'), path.join(ROOT, '.devtool', 'features', 'done')]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith(`card-${num}-`) && f.endsWith('.md')) return path.join(dir, f);
    }
  }
  return null;
}

/** Сессии рантайма с их файлами стенограмм. */
function allSessions() {
  const out = [];
  const root = reader.sessionsRoot();
  if (!root || !fs.existsSync(root)) return out;
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (!e.isDirectory()) continue;
      const mf = path.join(p, 'messages.jsonl');
      if (fs.existsSync(mf)) {
        const manifest = path.join(p, 'manifest.json');
        let id = path.basename(p);
        try {
          id = JSON.parse(fs.readFileSync(manifest, 'utf8')).sessionId || id;
        } catch {}
        out.push({ id, file: mf });
      } else {
        walk(p);
      }
    }
  };
  walk(root);
  return out;
}

/** Строки стенограммы: ответы ассистента с расходом и реплики человека. */
function readRows(file) {
  const rows = [];
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return rows;
  }
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const m = e.message;
    if (!m || !m.role) continue;
    const ts = Number(m.timestamp || 0);
    if (m.role === 'assistant') {
      rows.push({ type: 'assistant', id: e.message_id || null, ts, usage: m.usage || null, content: Array.isArray(m.content) ? m.content : [] });
    } else if (m.role === 'user') {
      rows.push({ type: 'user', id: e.message_id || null, ts, usage: null, content: [] });
    }
  }
  return rows;
}

/** Чью карточку трогает вызов инструмента; нет — null. */
function toolOwner(call) {
  const args = call.arguments || {};
  const name = String(call.name || '');
  let m = CARD_PATH_RE.exec(String(args.file_path || args.path || ''));
  if (m && /^(write|edit)$/i.test(name)) return m[1];
  m = CARD_MATERIAL_RE.exec(String(args.file_path || args.path || ''));
  if (m && /^(write|edit)$/i.test(name)) return m[1];
  const command = String(args.command || '');
  if (/^(bash|shell|powershell)$/i.test(name) || command) {
    if (/[\\/]\.devtool[\\/]features[\\/](?:done[\\/])?card-(\d{3})-/.test(command) || /[\\/]project[\\/]cards[\\/]card-(\d{3})[\\/]/.test(command)) {
      if (WRITE_CMD_RE.test(command)) {
        const hit = CARD_PATH_RE.exec(command) || CARD_MATERIAL_RE.exec(command);
        if (hit) return hit[1];
      }
    }
    if ((m = /(?:git commit|forma-commit)[\s\S]*?[Кк]арточк[аи] (\d{3})/.exec(command))) return m[1];
  }
  // Вызов субагента по карточке — работа Intent по координации этой карточки.
  if (/^task$/i.test(name) && (m = /card-(\d{3})(?!\d)/.exec(String(args.prompt || '')))) return m[1];
  return null;
}

/** Карточка, которой принадлежит ответ: первая найденная касающаяся карточка. */
function ownerOf(row) {
  if (row.type !== 'assistant') return null;
  for (const b of row.content) {
    if (!b || b.type !== 'toolCall') continue;
    const owner = toolOwner(b);
    if (owner) return owner;
  }
  return null;
}

/** Касается ли ответ проекта: путь ведёт в корень этого проекта. */
function touchesProject(row) {
  for (const b of row.content || []) {
    if (!b || b.type !== 'toolCall') continue;
    const args = b.arguments || {};
    for (const v of [args.path, args.file_path, args.command, args.prompt]) {
      if (typeof v === 'string' && v.includes(ROOT)) return true;
    }
  }
  return false;
}

/** Записи окна по событиям карточки: от реплики человека после прошлого события до самого события. */
function eventWindow(rows, num) {
  const ev = [];
  rows.forEach((e, i) => {
    const c = ownerOf(e);
    if (c) ev.push({ i, c });
  });
  const mine = new Set();
  let prev = -1;
  ev.forEach((x, n) => {
    if (x.c === num) {
      let s = prev + 1;
      if (x.c !== (ev[n - 1] || {}).c) while (s < x.i && rows[s].type !== 'user') s++;
      for (let k = s; k <= x.i; k++) mine.add(k);
    }
    prev = x.i;
  });
  return rows.map((e, k) => ({ e, k })).filter(({ k }) => mine.has(k));
}

/** Записи окна, заданного --from/--to. */
const manualWindow = (rows) =>
  rows.map((e, k) => ({ e, k })).filter(({ e }) => e.ts >= (FROM ?? 0) && e.ts <= (TO ?? Infinity));

/** Сумма окна за ответы строго позже `after` (мс; null — все). */
function sumWindow(rows, inWin, after) {
  const isNew = ({ e }) => after == null || e.ts > after;
  const counted = inWin.filter(isNew);
  if (!counted.length) return null;
  const firstRow = new Map();
  rows.forEach((e, k) => {
    if (e.type === 'assistant' && e.id && !firstRow.has(e.id)) firstRow.set(e.id, k);
  });
  const s = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, active: 0, calls: 0, from: counted[0].e.ts, to: counted[counted.length - 1].e.ts };
  for (const { e, k } of counted) {
    if (e.type !== 'assistant' || !e.usage) continue;
    if (e.id && firstRow.get(e.id) !== k) continue;
    s.input += e.usage.input || 0;
    s.output += e.usage.output || 0;
    s.cacheRead += e.usage.cacheRead || 0;
    s.cacheWrite += e.usage.cacheWrite || 0;
    s.calls += 1;
  }
  for (let i = 1; i < inWin.length; i++) {
    if (inWin[i].k !== inWin[i - 1].k + 1 || !isNew(inWin[i])) continue;
    s.active += Math.min(IDLE * 1000, Math.max(0, inWin[i].e.ts - inWin[i - 1].e.ts));
  }
  return s.calls ? s : null;
}

/** До какого момента ответы сессии `id` уже записаны в карточку (наибольшая граница), мс. */
function accountedUntil(cardText, id) {
  let until = null;
  for (const line of cardText.split(/\r?\n/)) {
    if (!/^-\s/.test(line) || !line.includes('`' + id + '`') || !line.includes('card-session-spend')) continue;
    const at = sessionWindowEnd(line);
    if (at != null && (until == null || at > until)) until = at;
  }
  return until;
}

/** Строки этой сессии в карточке без метки границы: их окно команда не знает — возможен двойной счёт. */
function linesWithoutBoundary(cardText, id) {
  let n = 0;
  for (const line of cardText.split(/\r?\n/)) {
    if (!/^-\s/.test(line) || !line.includes('`' + id + '`')) continue;
    if (sessionWindowEnd(line) == null) n += 1;
  }
  return n;
}

/** Строка расхода сессии за окно `r`. */
function spendLine(r) {
  const N = r.input + r.cacheWrite + r.cacheRead + r.output;
  const window = `окно ${hm(r.from)}–${hm(r.to)} UTC`;
  const edge = MANUAL ? '' : `, граница ${new Date(r.to).toISOString()}`;
  return (
    '- ' +
    formatSpendLine({
      node: 'Intent',
      date: new Date(r.to).toISOString().slice(0, 10),
      tokens: N,
      cache_read: r.cacheRead,
      tokens_out: r.output,
      duration_s: Math.round(r.active / 1000),
      call_id: r.id,
      engine: adapter.spendTag,
      desc: '',
    }) +
    `расход основной сессии по стенограмме (card-session-spend): ${r.calls} ответов, ${window}, ` +
    `выход ${sp(r.output)}, запись в кеш ${sp(r.cacheWrite)}${edge}.`
  );
}

/** Дописать строку в конец зоны `## История` карточки. */
function appendHistory(cardFilePath, line) {
  const text = fs.readFileSync(cardFilePath, 'utf8');
  const heading = text.indexOf('\n## История');
  if (heading === -1) {
    // Зоны нет — создаём её в конце файла, а не перед первым заголовком.
    fs.writeFileSync(cardFilePath, text.replace(/\s+$/, '') + '\n\n## История\n- ' + line + '\n', 'utf8');
    return;
  }
  const bodyStart = heading + '\n## История'.length;
  const nextHeading = text.indexOf('\n## ', bodyStart);
  const body = text.slice(bodyStart, nextHeading === -1 ? text.length : nextHeading).replace(/\s+$/, '');
  const tail = nextHeading === -1 ? '\n' : text.slice(nextHeading);
  // Строка уже начинается с «- » (её так печатает `spendLine`) — лишнюю черту не добавляем.
  fs.writeFileSync(cardFilePath, text.slice(0, bodyStart) + body + '\n' + line + '\n' + tail, 'utf8');
}

function main() {
  if (!CARD_ARG) {
    console.log('usage: card-session-spend.cjs <NNN> [--write] [--session <id>] [--idle 300] [--from ISO] [--to ISO]');
    process.exit(2);
  }
  const file = cardFile(CARD_ARG);
  if (!file) {
    console.log('карточка card-' + CARD_ARG + ' не найдена на доске');
    process.exit(1);
  }
  let cardText = fs.readFileSync(file, 'utf8');
  const sessions = ONLY_SESSION ? allSessions().filter((s) => s.id === ONLY_SESSION) : allSessions();

  let written = 0;
  for (const s of sessions) {
    const rows = readRows(s.file);
    if (!rows.length) continue;
    const inWin = MANUAL ? manualWindow(rows) : eventWindow(rows, CARD_ARG);
    if (!inWin.length) continue;
    // Сессия принадлежит этому проекту, если хоть одно её касание карточки ведёт в корень проекта.
    if (!rows.some(touchesProject)) continue;
    const after = MANUAL ? null : (AFTER != null ? Math.max(AFTER, accountedUntil(cardText, s.id) ?? -Infinity) : accountedUntil(cardText, s.id));
    if (AFTER == null && !MANUAL && linesWithoutBoundary(cardText, s.id) > 0) {
      console.error('внимание: в карточке есть строки этой сессии без метки «граница» — их окно команда не знает; уточните границу через --after <ISO>, иначе счёт задвоится');
    }
    const spend = sumWindow(rows, inWin, after);
    if (!spend) continue;
    const line = spendLine({ ...spend, id: s.id });
    console.log(line);
    if (flag('write')) {
      appendHistory(file, line);
      cardText = fs.readFileSync(file, 'utf8');
      written += 1;
    }
  }
  if (flag('write')) console.log('записано строк: ' + written);
  else if (!written) console.log('нового расхода нет — ничего не записано');
}

if (require.main === module) main();

module.exports = { readRows, toolOwner, ownerOf, eventWindow, sumWindow, spendLine, cardFile, allSessions };
