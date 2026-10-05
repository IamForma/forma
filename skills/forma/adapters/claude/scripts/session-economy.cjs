#!/usr/bin/env node
/**
 * Экономика сессий: перечитывание против работы.
 *
 * Запуск: node .claude/scripts/session-economy.cjs  →  .forma/dashboard/.cache/session-economy.json
 *         node .claude/scripts/session-economy.cjs --print   (ещё и ведомость в консоль)
 *
 * Считает по стенограммам `~/.claude/projects/<проект>/*.jsonl` — тем самым записям,
 * которые движок ведёт сам. Модель не вызывается ни разу: это арифметика по файлам.
 *
 * Три вещи, на которых здесь легко ошибиться молча, и потому они закреплены в коде:
 *
 * 1. ДЕДУПЛИКАЦИЯ ПО `requestId` — условие верности, а не оптимизация. Одна и та же
 *    запись usage лежит в стенограмме многократно (пересборка веток разговора). Без
 *    дедупликации счёт завышается ровно вдесятеро, и по правдоподобию числа этого не
 *    видно. Поэтому ниже есть самосверка с записью `cost-state` — чужой бухгалтерией
 *    движка, — и она печатает расхождение ВСЕГДА, а не только когда всё сошлось.
 * 2. ПОТОКОВОЕ ЧТЕНИЕ. Самый большой файл — под гигабайт, весь корпус 1.7 ГБ. Ни один
 *    файл не читается целиком в память, и до `JSON.parse` стоит дешёвый отсев подстрокой:
 *    нужных строк — проценты, а разбор каждой строки стоит минуты.
 * 3. ТОЛЬКО ЧТЕНИЕ. Каталог `~/.claude/projects/` — чужой, это стенограммы сессий.
 *    Скрипт не пишет и не удаляет там ничего; единственная запись — свой кэш в
 *    `.forma/dashboard/.cache/`.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const economy = require('../../.forma/dashboard/economy.cjs');
// Адаптер Claude Code: поля `usage` движка → канонические переменные (.forma/manual/en/03-forma/ECONOMY.md).
const { claudeUsage } = require('./claude-economy.cjs');
const { readJson } = require('../../.forma/dashboard/lib/fs.cjs');
const { makeCli } = require('../../.forma/dashboard/lib/cli.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const CACHE_DIR = path.join(ROOT, '.forma/dashboard', '.cache');
const OUT_FILE = path.join(CACHE_DIR, 'session-economy.json');

/* Версия метода. Меняется вместе с арифметикой — по ней кэш отличает своё от чужого.
   Забыть её поднять при правке счёта — единственный способ получить здесь смесь
   старых и новых чисел, и потому она стоит первой строкой настроек. */
const METHOD_VERSION = 3;

// Считаются все сессии, любого размера: короткая сессия — тоже расход.
const MIN_SIZE = 0;
// Расхождение с `cost-state` выше этого — подозрительное, помечается на экране.
const SUSPECT_PCT = 2;
// Неделя с выходом меньше этого — не показание, а шум одной короткой сессии.
const WEEK_MIN_OUTPUT = 10000;
// Файл, тронутый недавно, считаем живой сессией: её числа неполны по определению.
const LIVE_WINDOW_MS = 30 * 60 * 1000;

/* Тариф API на токен. Выведен из уравнения записи `cost-state` для `opus` и сошёлся
   с её же фактом на 0.0067%. Это ОЦЕНКА и запасной путь: где у сессии есть `cost-state`,
   деньги берутся оттуда — у движка они точные, и выдумывать их незачем. */
const PRICE = {
  opus:   { cr: 0.5e-6, cc: 10e-6,   in: 5e-6, out: 25e-6 },
  sonnet: { cr: 0.3e-6, cc: 3.75e-6, in: 3e-6, out: 15e-6 },
  haiku:  { cr: 0.1e-6, cc: 1.25e-6, in: 1e-6, out: 5e-6 },
};
const priceOf = (model) => {
  const m = String(model || '').toLowerCase();
  if (m.includes('haiku')) return PRICE.haiku;
  if (m.includes('sonnet')) return PRICE.sonnet;
  return PRICE.opus;
};

/** Каталог стенограмм этого проекта. Имя движок строит из пути: всё, что не буква и
 *  не цифра, становится дефисом. Правило не документировано, поэтому есть отход:
 *  если точного совпадения нет — ищем без учёта регистра среди существующих. */
function transcriptDir() {
  const base = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(base)) return null;
  const encoded = ROOT.replace(/[^A-Za-z0-9]/g, '-');
  const candidates = [encoded, encoded.charAt(0).toLowerCase() + encoded.slice(1)];
  for (const c of candidates) {
    const p = path.join(base, c);
    if (fs.existsSync(p)) return p;
  }
  const want = encoded.toLowerCase();
  const found = fs.readdirSync(base).find((d) => d.toLowerCase() === want);
  return found ? path.join(base, found) : null;
}

/** Состояние разбора одной стенограммы: суммы по сессии, дедупликация, след вызовов и точка сверки. */
function newParseState() {
  return {
    seen: new Set(),
    total: economy.emptyUsage(),
    first: null, last: null,
    // Срез на момент последней `cost-state`: копится параллельно, замораживается на строке.
    anchor: null,
    byModel: {},
    /* Поштучный след вызовов — только (время, R, создание, выход), несколько тысяч чисел
       на сессию. Он нужен ради сверки: `cost-state` считает от своего `startTime`, а в
       стенограмме перед ним лежат вызовы, унаследованные от прошлой сессии (продолжение
       после сжатия копирует историю вместе с их `requestId`). Сверять с ними значило бы
       обвинять движок в недосчёте там, где расходятся границы отсчёта, а не числа. */
    trail: [],
  };
}

/** Срез на строке `cost-state`: наш счёт по следу и счёт движка. Пустая запись
 *  (сессия ничего не потратила) точкой сверки быть не может — тогда null. */
function costStateAnchor(j, trail) {
  const mu = j.modelUsage || {};
  const sum = (k) => Object.values(mu).reduce((a, m) => a + (m[k] || 0), 0);
  const cr = sum('cacheReadInputTokens');
  if (!(cr > 0)) return null;
  // Наш счёт до этой строки, но от той же точки отсчёта, что у движка.
  const startedAt = Number(j.startTime) || 0;
  const mine = { cr: 0, cc: 0, out: 0, calls: 0, inherited: 0 };
  for (const c of trail) {
    if (c.ts < startedAt) { mine.inherited += 1; continue; }
    mine.calls += 1; mine.cr += c.cr; mine.cc += c.cc; mine.out += c.out;
  }
  return {
    startedAt,
    mine,
    // Счёт движка на той же строке.
    theirs: {
      cr,
      cc: sum('cacheCreationInputTokens'),
      out: sum('outputTokens'),
      costUsd: Number(j.totalCostUSD) || 0,
    },
  };
}

/** Запись с usage: в суммы сессии и модели (один раз на `requestId`), во след вызовов. */
function addCall(st, j) {
  const u = j.message && j.message.usage;
  if (!u || u.cache_read_input_tokens == null) return;
  const key = j.requestId || j.uuid; // см. пункт 1 в шапке
  if (st.seen.has(key)) return;
  st.seen.add(key);

  const cu = claudeUsage(u);
  economy.addUsage(st.total, cu);
  const model = (j.message && j.message.model) || 'unknown';
  economy.addUsage(st.byModel[model] || (st.byModel[model] = economy.emptyUsage()), cu);

  if (j.timestamp) { if (!st.first) st.first = j.timestamp; st.last = j.timestamp; }
  st.trail.push({
    ts: j.timestamp ? Date.parse(j.timestamp) : 0,
    cr: u.cache_read_input_tokens,
    cc: u.cache_creation_input_tokens || 0,
    out: u.output_tokens || 0,
  });
}

/** Одна строка стенограммы в состояние разбора. */
function readTranscriptLine(st, line) {
  // Дешёвый отсев до разбора — см. пункт 2 в шапке.
  const hasUsage = line.includes('cache_read_input_tokens');
  const hasCost = line.includes('"cost-state"');
  if (!hasUsage && !hasCost) return;

  let j;
  try { j = JSON.parse(line); } catch { return; /* оборванная строка */ }

  if (j.type === 'cost-state') {
    const anchor = costStateAnchor(j, st.trail);
    if (anchor) st.anchor = anchor;
    return;
  }
  addCall(st, j);
}

/** Оценка по тарифу — помодельно, иначе сессия на sonnet считалась бы по opus. */
function estimateUsd(byModel) {
  return Object.entries(byModel).reduce((a, [m, v]) => {
    const p = priceOf(m);
    return a + v.cache_read * p.cr + v.cache_write * p.cc + v.tokens_in * p.in + v.tokens_out * p.out;
  }, 0);
}

/** Сверка с чужой бухгалтерией: печатается всегда, в том числе когда всё сошлось. */
function reconcile(anchor) {
  if (!(anchor && anchor.theirs.cr)) return null;
  const rel = (mine, theirs) => (theirs ? ((mine - theirs) / theirs) * 100 : null);
  const crPct = rel(anchor.mine.cr, anchor.theirs.cr);
  const ccPct = rel(anchor.mine.cc, anchor.theirs.cc);
  const outPct = rel(anchor.mine.out, anchor.theirs.out);
  return {
    crPct: Number(crPct.toFixed(2)),
    ccPct: ccPct == null ? null : Number(ccPct.toFixed(2)),
    outPct: outPct == null ? null : Number(outPct.toFixed(2)),
    mine: anchor.mine,
    theirs: anchor.theirs,
    // Сколько вызовов в файле старше точки отсчёта движка — унаследованная история.
    inheritedCalls: anchor.mine.inherited,
    suspect: Math.abs(crPct) > SUSPECT_PCT,
  };
}

/** Строка сессии из состояния разбора. */
function sessionRow(st) {
  const t = st.total;
  const { anchor } = st;
  return {
    calls: t.calls,
    cacheRead: t.cache_read,
    cacheCreate: t.cache_write,
    input: t.tokens_in,
    output: t.tokens_out,
    // «Работа» здесь — выход модели: произведённые токены. Это та самая величина,
    // против которой меряется перечитывание; названа на экране прямо, чтобы её
    // не спутали с «всё, что не кэш-чтение».
    ratio: t.tokens_out ? Number(economy.readPerOutput(t).toFixed(1)) : null,
    estUsd: Number(estimateUsd(st.byModel).toFixed(4)),
    // Деньги движка — точные; наша оценка остаётся рядом, видно расхождение.
    costUsd: anchor ? Number(anchor.theirs.costUsd.toFixed(4)) : null,
    models: Object.keys(st.byModel).sort(),
    first: st.first, last: st.last,
    check: reconcile(anchor),
  };
}

/** Разбор одной стенограммы потоком. Возвращает суммы по сессии и, отдельно, срез
 *  на строке последней записи `cost-state` — он и есть точка сверки. */
async function parseSession(file) {
  const st = newParseState();
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  for await (const line of rl) readTranscriptLine(st, line);
  return sessionRow(st);
}

/** Неделя по ISO — ключ вида 2026-W38. Ход по времени показывается по неделям:
 *  по дням шум сессий забивает тренд, одним числом тренда не видно вовсе. */
function isoWeek(iso) {
  const d = new Date(iso);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Строка сессии из кэша (тот же размер и mtime) или свежим разбором; null — файл не разобрался. */
async function cachedOrParsed(full, name, stat, hit) {
  if (hit && hit.size === stat.size && hit.mtimeMs === stat.mtimeMs) return { row: hit.row, cached: true };
  try { return { row: await parseSession(full), cached: false }; } catch (e) {
    console.error(`пропуск ${name}: ${e.message}`);
    return null;
  }
}

/** Все файлы каталога → строки сессий, обновлённый кэш и счётчики прогона. */
async function collectSessions(dir, files, cache, now) {
  const out = { sessions: [], nextCache: {}, parsed: 0, fromCache: 0, skipped: 0 };
  for (const f of files) {
    const full = path.join(dir, f);
    const st = fs.statSync(full);
    if (st.size < MIN_SIZE) { out.skipped += 1; continue; }
    const sessionId = f.replace(/\.jsonl$/, '');
    const got = await cachedOrParsed(full, f, st, cache[sessionId]);
    if (!got) continue;
    if (got.cached) out.fromCache += 1; else out.parsed += 1;
    out.nextCache[sessionId] = { size: st.size, mtimeMs: st.mtimeMs, row: got.row };
    if (!got.row.calls) continue;
    out.sessions.push({
      sessionId,
      // Живая сессия считается до последней записи на диске — её числа неполны.
      live: now - st.mtimeMs < LIVE_WINDOW_MS,
      sizeBytes: st.size,
      ...got.row,
    });
  }
  return out;
}

function sumTotals(sessions) {
  const S = (k) => sessions.reduce((a, s) => a + (s[k] || 0), 0);
  const totals = {
    sessions: sessions.length,
    calls: S('calls'),
    cacheRead: S('cacheRead'),
    cacheCreate: S('cacheCreate'),
    input: S('input'),
    output: S('output'),
    estUsd: Number(S('estUsd').toFixed(2)),
    // Деньги движка — только по тем сессиям, где `cost-state` есть; складывать их с
    // оценкой в одно число нельзя, поэтому рядом стоит покрытие этой величины.
    costUsd: Number(sessions.reduce((a, s) => a + (s.costUsd || 0), 0).toFixed(2)),
    costUsdSessions: sessions.filter((s) => s.costUsd != null).length,
    // Лучшее, что известно про каждую сессию: факт движка, а где его нет — оценка.
    bestUsd: Number(sessions.reduce((a, s) => a + (s.costUsd != null ? s.costUsd : s.estUsd), 0).toFixed(2)),
  };
  totals.ratio = totals.output ? Number((totals.cacheRead / totals.output).toFixed(1)) : null;
  return totals;
}

// Ход по неделям — ответ на вопрос «падает или растёт», которого одно число не даёт.
function weeklyTrend(sessions) {
  const weeks = {};
  for (const s of sessions) {
    if (!s.first) continue;
    const k = isoWeek(s.first);
    const w = weeks[k] || (weeks[k] = { week: k, sessions: 0, cacheRead: 0, output: 0, calls: 0, estUsd: 0 });
    w.sessions += 1; w.cacheRead += s.cacheRead; w.output += s.output;
    w.calls += s.calls; w.estUsd += s.estUsd;
  }
  return Object.values(weeks)
    .sort((a, b) => a.week.localeCompare(b.week))
    /* Неделя, где работы почти не было (открыли сессию и закрыли), даёт соотношение,
       которое выглядит как показание, а показанием не является. Такая неделя стоит в
       ходе как пропуск — по правилу вкладки: отсутствие данных показано как отсутствие. */
    .map((w) => ({
      ...w,
      estUsd: Number(w.estUsd.toFixed(2)),
      thin: w.output < WEEK_MIN_OUTPUT,
      ratio: w.output >= WEEK_MIN_OUTPUT ? Number((w.cacheRead / w.output).toFixed(1)) : null,
    }));
}

function verifyAgainstCostState(sessions) {
  const checked = sessions.filter((s) => s.check);
  return {
    sessionsChecked: checked.length,
    sessionsTotal: sessions.length,
    // Худшее расхождение — то, по чему судят о методе; среднее спрятало бы выброс.
    worstCrPct: checked.length ? checked.reduce((a, s) => (Math.abs(s.check.crPct) > Math.abs(a) ? s.check.crPct : a), 0) : null,
    suspectCount: checked.filter((s) => s.check.suspect).length,
    suspectThresholdPct: SUSPECT_PCT,
    rows: checked.map((s) => ({ sessionId: s.sessionId, date: (s.first || '').slice(0, 10), crPct: s.check.crPct, ccPct: s.check.ccPct, outPct: s.check.outPct, inheritedCalls: s.check.inheritedCalls, suspect: s.check.suspect })),
  };
}

async function build() {
  const dir = transcriptDir();
  if (!dir) {
    return { error: 'Каталог стенограмм не найден — ведомость не собрана.', sessions: [] };
  }

  // Кэш по sessionId + размер файла (и mtime): пересобирается только изменившееся.
  let cache = {};
  // Кэш верен только для той же версии метода: изменилась арифметика — сохранённые
  // строки посчитаны по-старому, и молча пережить правку они не должны. Нет кэша — соберём заново.
  const prev = readJson(OUT_FILE, null);
  if (prev && prev.method === METHOD_VERSION) cache = prev.cache || {};

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  const { sessions, nextCache, parsed, fromCache, skipped } = await collectSessions(dir, files, cache, Date.now());
  sessions.sort((a, b) => String(a.first).localeCompare(String(b.first)));

  return {
    generatedAt: new Date().toISOString(),
    method: METHOD_VERSION,
    transcriptDir: dir,
    run: { parsed, fromCache, skippedSmall: skipped, filesSeen: files.length },
    totals: sumTotals(sessions),
    sessions,
    byWeek: weeklyTrend(sessions),
    verification: verifyAgainstCostState(sessions),
    cache: nextCache,
  };
}

function print(data) {
  if (data.error) { console.log(data.error); return; }
  const n = (x) => Math.round(x).toLocaleString('ru-RU');
  console.log(`разобрано ${data.run.parsed} из ${data.run.parsed + data.run.fromCache}, остальные из кэша (${data.run.fromCache})`);
  console.log('');
  console.log('дата        вызовов   R(млн)  выход(тыс)  R/выход      $  живая');
  for (const s of data.sessions) {
    console.log(
      String(s.first || '?').slice(0, 10).padEnd(12) +
      String(s.calls).padStart(7) +
      (s.cacheRead / 1e6).toFixed(1).padStart(9) +
      (s.output / 1e3).toFixed(0).padStart(11) +
      String(s.ratio ?? '—').padStart(9) +
      ('$' + (s.costUsd ?? s.estUsd).toFixed(0)).padStart(7) +
      (s.live ? '   да' : '     '));
  }
  console.log('-'.repeat(64));
  console.log('ИТОГО       ' + String(data.totals.calls).padStart(7) +
    (data.totals.cacheRead / 1e6).toFixed(0).padStart(9) +
    (data.totals.output / 1e3).toFixed(0).padStart(11) +
    String(data.totals.ratio).padStart(9) +
    ('$' + n(data.totals.bestUsd)).padStart(7));
  console.log(`деньги движка у ${data.totals.costUsdSessions} из ${data.totals.sessions} сессий, остальные — оценка по тарифу`);
  console.log('');
  console.log('ход по неделям (перечитывания на токен выхода):');
  for (const w of data.byWeek) console.log(`  ${w.week}  ${String(w.ratio ?? '—').padStart(6)}   сессий ${w.sessions}${w.thin ? '  (мало работы, не показание)' : ''}`);
  console.log('');
  const v = data.verification;
  console.log(`самосверка с cost-state: сессий с точкой сверки ${v.sessionsChecked} из ${v.sessionsTotal}`);
  for (const r of v.rows) {
    console.log(`  ${r.date}  R ${r.crPct > 0 ? '+' : ''}${r.crPct}%  создание ${r.ccPct > 0 ? '+' : ''}${r.ccPct}%  выход ${r.outPct > 0 ? '+' : ''}${r.outPct}%  унаследовано вызовов ${r.inheritedCalls}${r.suspect ? '   ПОДОЗРИТЕЛЬНО' : ''}`);
  }
  console.log(`худшее расхождение по R: ${v.worstCrPct}% (порог подозрения ${v.suspectThresholdPct}%)`);
}

/* Статья «Intent ↔ человек, текущая сессия» (AGENTS.md §3). Только файлы основной
   сессии верхнего уровня: стенограммы субагентов лежат в `<сессия>/subagents/` и сюда не
   попадают — их расход уже записан в `## История` карточек, второй раз он не считается.
   «Текущая» — живая, тронутая за LIVE_WINDOW_MS: сессий, открытых параллельно, может быть
   несколько, и выбрать одну по mtime значило бы угадать. `--session <id>` — одна явно.
   Кэш и порог MIN_SIZE здесь не участвуют: файлы живые и небольшие. */
const CURRENT_FILE = path.join(CACHE_DIR, 'session-current.json');

async function buildCurrent(id) {
  const dir = transcriptDir();
  if (!dir) return { error: 'Каталог стенограмм не найден.', sessions: [] };
  const now = Date.now();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
    .filter((f) => id && id !== 'current'
      ? f === id + '.jsonl'
      : now - fs.statSync(path.join(dir, f)).mtimeMs < LIVE_WINDOW_MS);
  const sessions = [];
  for (const f of files) {
    const row = await parseSession(path.join(dir, f));
    if (!row.calls) continue;
    sessions.push({
      sessionId: f.replace(/\.jsonl$/, ''),
      calls: row.calls, input: row.input, output: row.output,
      cacheCreate: row.cacheCreate, cacheRead: row.cacheRead,
      // Работа — всё, кроме кэш-чтения; тот же раздел, что `N tokens (R cache-read)` в §3.
      work: economy.usageWork({ tokens_in: row.input, tokens_out: row.output, cache_write: row.cacheCreate }),
      usd: row.costUsd != null ? row.costUsd : row.estUsd,
      usdExact: row.costUsd != null,
      first: row.first, last: row.last,
    });
  }
  const S = (k) => sessions.reduce((a, s) => a + (s[k] || 0), 0);
  return {
    generatedAt: new Date().toISOString(),
    method: METHOD_VERSION,
    selector: id || 'current',
    sessions,
    totals: { sessions: sessions.length, calls: S('calls'), work: S('work'), cacheRead: S('cacheRead'), output: S('output'), usd: Number(S('usd').toFixed(2)) },
  };
}

(async () => {
  const cli = makeCli();
  if (cli.flag('session')) {
    const data = await buildCurrent(cli.value('session'));
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CURRENT_FILE, JSON.stringify(data, null, 2), 'utf8');
    const n = (x) => Math.round(x).toLocaleString('ru-RU');
    for (const s of data.sessions) console.log(`${s.sessionId}  вызовов ${s.calls}  работа ${n(s.work)}  кэш-чтение ${n(s.cacheRead)}  $${s.usd.toFixed(2)}${s.usdExact ? '' : ' (оценка)'}`);
    if (data.error) console.log(data.error);
    console.log(`→ ${path.relative(ROOT, CURRENT_FILE)}`);
    return;
  }
  const data = await build();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 2), 'utf8');
  if (!data.error) {
    console.log(`разобрано ${data.run.parsed} из ${data.run.parsed + data.run.fromCache}, остальные из кэша (${data.run.fromCache})`);
    const v = data.verification;
    console.log(`самосверка: ${v.sessionsChecked} из ${v.sessionsTotal} сессий, худшее расхождение по R ${v.worstCrPct}%, подозрительных ${v.suspectCount} (порог ${v.suspectThresholdPct}%)`);
  }
  if (cli.flag('print')) { console.log(''); print(data); }
  console.log(`→ ${path.relative(ROOT, OUT_FILE)}`);
})();
