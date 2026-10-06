#!/usr/bin/env node
'use strict';

/**
 * Пилотный счётчик заходов/токенов/денег по историям карточек.
 * Источник данных — строго формат раздела 3 AGENTS.md (ключевая часть — английская
 * при любом языке проекта):
 *   `Node`, YYYY-MM-DD: attempt, N tokens (R cache-read), T s, `<id>` — <что сделано>
 *   `Node`, YYYY-MM-DD: attempt, N tokens, T s, $X.XXXXXX (provider/model) — <что сделано>
 * Русская форма старых строк («заход, N токенов…») читается через toEnglish() (spend-line.cjs).
 * Денежный сегмент опционален — только для заходов через внешнюю модель, не Agent tool.
 * Читает готовые факты, ничего не оценивает и не угадывает.
 *
 * Использование:
 * Ядро: живёт в .forma/dashboard/ рядом с economy.cjs; адаптер движка может держать у себя тонкую ссылку на этот модуль.
 *   node tally.cjs <файл-или-каталог> [ещё файл-или-каталог ...]
 *   node tally.cjs --report [<файл-или-каталог> ...]   → знаменатель, глазами
 *   node tally.cjs --routes [--json] [<файл-или-каталог> ...] → разрез по route-N/over-N/seg-N/wave-N
 *
 * Каталог обходится рекурсивно, берутся только *.md.
 * Вывод — JSON в stdout, ключи английские: byNode и total, плюс unparsed — строки,
 * которые похожи на запись захода, но не распознались (для ручной проверки формата).
 */

const fs = require('fs');
const path = require('path');
const economy = require('./economy.cjs');
const { walk } = require('./lib/fs.cjs');
const { frontmatterBlock } = require('./lib/card.cjs');
const engines = require('./lib/engines.cjs');
const { toEnglish, SPEND_SOURCE, CLAIM_RE, CACHE_UNKNOWN_RE, TOKENS_UNKNOWN_RE, ID_UNKNOWN_RE, toInt, sessionWindowEnd } = require('./spend-line.cjs');

// Три вещи, на которых этот разбор ломался или сломался бы:
//   1. Разряды числа пишут через пробел («52 339 tokens») — простое \d+ такую строку не берёт.
//   2. Кэш-чтение (AGENTS.md §3) стоит в скобках сразу после токенов.
//   3. Секунды обязательными быть не могут: в записанных строках они есть не везде,
//      а требовать их значит молча терять заход целиком вместо одного поля.
// Группы — spend-line.cjs; здесь добавлены только привязка к `^-` и описание после тире.
const LINE_RE = new RegExp('^-\\s*' + SPEND_SOURCE + '—\\s*(.*)$', 'i');

// Внешний сервис считает в своей единице (Magnific — credits, другой — минуты).
// Имён сервисов разбор не знает: берёт любое «N <unit> (<service>/<operation>)».
// Отличает сервис от времени форма, а не слово: у сервиса есть скобка с косой чертой.
const SERVICE_RE = /(\d[\d\s  ]*)\s*([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё.]*)\s*\(([^)\/]+)\/([^)]+)\)/g;

// Строки, похожие на запись захода (есть «attempt,» и дата), но не подошедшие под LINE_RE —
// повод проверить формат руками, а не молча потерять данные.
const SUSPECT_RE = new RegExp('`[^`]+`,\\s*' + CLAIM_RE.source);

function collectFiles(targets) {
  const files = [];
  for (const target of targets) {
    const stat = fs.statSync(target);
    if (stat.isDirectory()) files.push(...walk(target, { ext: '.md', abs: true }));
    else if (stat.isFile() && target.endsWith('.md')) files.push(target);
  }
  return files;
}

function tally(targets) {
  return tallyFiles(collectFiles(targets), new Set());
}

/** Ключ движка строки: тег после тире; нет тега — undefined (в разрезе — `untagged`, economy.byEngine). */
const engineKey = (line) => { const m = /—\s*([a-z][a-z0-9-]*):/.exec(line); return m ? m[1] : undefined; };

//** «N <unit> (<service>/<operation>)» из хвоста строки: расход внешних сервисов. */
function serviceUnits(tail) {
  const ext = [];
  SERVICE_RE.lastIndex = 0;
  let sv;
  while ((sv = SERVICE_RE.exec(tail || '')) !== null) ext.push({ service: sv[3].trim(), unit: sv[2], amount: toInt(sv[1]) });
  return ext;
}

/** id вызова в конце хвоста строки; `id unknown` или его отсутствие — false/null. */
const callIdMatch = (line, tail) => !ID_UNKNOWN_RE.test(line) && /`([^`\s]+)`\s*$/.exec(tail || '');

// Строка основной сессии (card-session-spend) несёт id сессии — он общий для всех
// карточек сессии, а доля у каждой своя: ключ дедупликации — карточка + id. Строки с меткой
// границы окна — приращения одной сессии по одной карточке, каждая за свои ответы: метка в ключе.
// Старые строки без метки (накопительные) по-прежнему схлопываются в первую.
// Обычные строки: id вызова плюс числа захода. Один вызов, записанный в двух карточках теми же числами, —
// дубль; общий id сессии с разными числами — разные окна, считаются все (раньше вторая и далее терялись).
function dedupKey(line, file, id, m) {
  return /card-session-spend/.test(line)
    ? path.basename(file) + "|" + id + "|" + (sessionWindowEnd(line) ?? "")
    : [id, m[3], m[4] ?? "", m[5] ?? ""].join("|");
}

// Строка → канонические переменные (.forma/manual/en/03-forma/ECONOMY.md); счёт — economy.cjs.
// null — маркер `unknown` (отдельно), undefined — поле не записано.
function attemptRecord(m, line, idMatch) {
  const [, node, , tokensStr, cacheStr, secondsStr, turnsStr, costStr, , tail] = m;
  return {
    node,
    engine: engineKey(line),
    tokens: TOKENS_UNKNOWN_RE.test(line) ? null : toInt(tokensStr),
    cache_read: cacheStr != null ? toInt(cacheStr) : (CACHE_UNKNOWN_RE.test(line) ? null : undefined),
    duration_s: secondsStr == null ? undefined : (secondsStr === 'unknown' ? null : toInt(secondsStr)),
    turns: turnsStr == null ? undefined : toInt(turnsStr),
    call_id: ID_UNKNOWN_RE.test(line) ? null : (idMatch ? idMatch[1] : undefined),
    usd: costStr ? parseFloat(costStr) : undefined,
    ext_units: serviceUnits(tail),
  };
}

// Что сделать со строкой: { unparsed } — назвать; { dup } — id уже учтён; { rec } — записать; {} — пропустить.
function readLine(raw, file, engine, seenIds) {
  const line = toEnglish(raw.trim());
  const m = LINE_RE.exec(line);
  if (!m) return SUSPECT_RE.test(line) ? { unparsed: line } : {};
  // Совпадение с формой ещё не значит число: строка вроде «attempt, tokens не
  // записано» когда-то проходила разбор и уносила весь итог в NaN. Вторая,
  // независимая от строгости формы защита: нечисло в сумму не попадает НИКОГДА,
  // а строка уходит в unparsed — то есть называется файлом и текстом.
  if (!TOKENS_UNKNOWN_RE.test(line) && !Number.isFinite(toInt(m[3]))) return { unparsed: line };
  if (engine && (engineKey(line) || 'untagged') !== engine) return {};
  const idMatch = callIdMatch(line, m[9]);
  if (idMatch) {
    const key = dedupKey(line, file, idMatch[1], m);
    if (seenIds.has(key)) return { dup: true };
    seenIds.add(key);
  }
  return { rec: attemptRecord(m, line, idMatch) };
}

function newTallyState() {
  // Карточки, где заход записан хоть кем-то. Отдельно от `files` по узлам: сумма
  // по узлам считает одну карточку столько раз, сколько узлов в ней отметилось,
  // и покрытие вышло бы завышенным.
  return { byNode: {}, records: [], engineFiles: {}, unparsed: [], filesWithAttempt: new Set() };
}

function absorb(st, file, res) {
  const name = path.basename(file);
  if (res.unparsed) { st.unparsed.push({ file: name, line: res.unparsed }); return; }
  if (res.dup) { st.filesWithAttempt.add(name); return; }
  const rec = res.rec;
  if (!rec) return;
  if (!st.byNode[rec.node]) st.byNode[rec.node] = Object.assign(economy.emptyAcc(), { files: new Set() });
  economy.addAttempt(st.byNode[rec.node], rec);
  st.records.push(rec);
  const ek = rec.engine || 'untagged';
  (st.engineFiles[ek] || (st.engineFiles[ek] = new Set())).add(name);
  st.byNode[rec.node].files.add(name);
  st.filesWithAttempt.add(name);
}

/** Разрез по узлам и общий итог; услуги внешних сервисов сливаются по всем узлам. */
function summarizeNodes(byNode) {
  const services = {};
  for (const v of Object.values(byNode)) for (const [k, x] of Object.entries(v.services)) services[k] = (services[k] || 0) + x;
  const total = { attempts: 0, tokens: 0, tokensUnknown: 0, seconds: 0, secondsUnknown: 0, turns: 0, usd: 0, services };
  const nodesOut = {};
  for (const [node, v] of Object.entries(byNode)) {
    nodesOut[node] = {
      attempts: v.attempts,
      tokens: v.tokens,
      tokensUnknown: v.tokensUnknown,
      secondsUnknown: v.secondsUnknown,
      seconds: v.seconds,
      withSeconds: v.withSeconds,
      turns: v.turns,
      withTurns: v.withTurns,
      cacheRead: v.cacheRead,
      work: v.work,
      withCacheRead: v.withCacheRead,
      tokensWithCacheRead: v.tokensWithCacheRead,
      cacheUnknown: v.cacheUnknown,
      idUnknown: v.idUnknown,
      usd: Number(v.usd.toFixed(6)),
      files: v.files.size,
    };
    total.attempts += v.attempts;
    total.tokens += v.tokens;
    total.tokensUnknown += v.tokensUnknown;
    total.secondsUnknown += v.secondsUnknown;
    total.seconds += v.seconds;
    total.turns += v.turns;
    total.usd += v.usd;
  }
  total.usd = Number(total.usd.toFixed(6));
  return { nodesOut, total };
}

// По движкам — economy.byEngine. Токены ключей между собой не складываются;
// `unknown` — отдельным числом по каждому полю.
function summarizeEngines(records, engineFiles) {
  const byEngine = {};
  for (const [k, v] of Object.entries(economy.byEngine(records))) {
    byEngine[k] = {
      attempts: v.attempts, tokens: v.tokens, cacheRead: v.cacheRead, withCacheRead: v.withCacheRead,
      seconds: v.seconds, withSeconds: v.withSeconds, usd: Number(v.usd.toFixed(6)),
      cards: engineFiles[k] ? engineFiles[k].size : 0,
      unknown: economy.unknownCount(v),
    };
  }
  return byEngine;
}

// seenIds передаётся снаружи, чтобы разрез по маршрутам (byRoute) схлопывал общий id
// так же, как сквозной счёт: один вызов — один раз на весь корпус.
// engine — необязательный фильтр по ключу движка (`untagged` — строки без тега):
// разрез одного движка, чтобы токены разных движков не сошлись в одну сумму.
// Один вызов, обслуживший несколько карточек, записан в каждой той же строкой
// (AGENTS.md §3, id вызова). Считается один раз — по id.
// Строки без id (`id unknown`, заход без отдельного вызова) не схлопываются.
function tallyFiles(files, seenIds, engine) {
  const st = newTallyState();
  for (const file of files) {
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) absorb(st, file, readLine(raw, file, engine, seenIds));
  }
  const { nodesOut, total } = summarizeNodes(st.byNode);
  return {
    filesProcessed: files.length,
    cardsWithAttempt: st.filesWithAttempt.size,
    byNode: nodesOut,
    byEngine: summarizeEngines(st.records, st.engineFiles),
    total,
    unparsed: st.unparsed,
  };
}

// ─────────────────────────── разрез по маршрутам ───────────────────────────
// Метки маршрутов — AGENTS.md §6 и .forma/manual/en/03-forma/ROUTES.md §3: route-0…route-8,
// over-1…over-4 (надстройки, считаются своей таблицей: у карточки их может быть
// несколько), seg-N и wave-N (срезы route-8). Старая `route-intent-run` = `route-2`.
// Доля подготовки — расход Spec + Kit к расходу карточек маршрута; на route-4 Kit —
// исполнитель, там подготовка — только Spec. Возвраты — заходы исполнителя (Run;
// на route-4 — Kit) сверх первого на карточке: tally их отдельно не считал.
// Карточка без метки маршрута — строка «без маршрута».

const ROUTE_ALIAS = { 'route-intent-run': 'route-2' };
const NO_ROUTE = 'без маршрута';

function readLabels(text) {
  const fm = frontmatterBlock(text);
  const m = fm && /^labels:\s*\[(.*)\]\s*$/m.exec(fm);
  if (!m) return [];
  return m[1].split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    .map((l) => ROUTE_ALIAS[l] || l);
}

function emptyRow(key) {
  return { key, cards: 0, attempts: 0, tokens: 0, tokensUnknown: 0, cacheRead: 0, cacheUnknown: 0,
    seconds: 0, secondsUnknown: 0, turns: 0, returns: 0, prepTokens: 0, prepNodes: 'Spec+Kit' };
}

function byRoute(targets, engine) {
  const files = collectFiles(targets);
  const seenIds = new Set();
  const tables = { route: {}, over: {}, seg: {}, wave: {} };
  for (const file of files) {
    const labels = readLabels(fs.readFileSync(file, 'utf8'));
    const t = tallyFiles([file], seenIds, engine);
    if (engine && !Object.keys(t.byNode).length) continue;
    const route = labels.find((l) => /^route-\d+$/.test(l));
    const prep = route === 'route-4' ? ['Spec'] : ['Spec', 'Kit'];
    const executor = route === 'route-4' ? 'Kit' : 'Run';
    const keys = [['route', route || NO_ROUTE]];
    for (const l of labels) {
      const k = /^(over|seg|wave)-\d+$/.exec(l);
      if (k) keys.push([k[1], l]);
    }
    for (const [table, key] of keys) {
      const row = tables[table][key] || (tables[table][key] = emptyRow(key));
      if (table === 'route' && route === 'route-4') row.prepNodes = 'Spec';
      row.cards += 1;
      for (const [node, v] of Object.entries(t.byNode)) {
        row.attempts += v.attempts;
        row.tokens += v.tokens;
        row.tokensUnknown += v.tokensUnknown;
        row.cacheRead += v.cacheRead;
        row.cacheUnknown += v.cacheUnknown;
        row.seconds += v.seconds;
        row.secondsUnknown += v.secondsUnknown;
        row.turns += v.turns;
        if (prep.includes(node)) row.prepTokens += v.tokens;
        if (node === executor) row.returns += Math.max(0, v.attempts - 1);
      }
    }
  }
  const order = (a, b) => (a.key === NO_ROUTE) - (b.key === NO_ROUTE)
    || a.key.localeCompare(b.key, 'en', { numeric: true });
  const out = {};
  for (const [name, rows] of Object.entries(tables)) {
    out[name] = Object.values(rows).sort(order).map((r) => ({
      ...r, prepShare: r.tokens ? Math.round((r.prepTokens / r.tokens) * 100) : null,
    }));
  }
  return out;
}

function routeReport(targets) {
  const t = byRoute(targets);
  const L = ['Расход по маршрутам (метки route-N / over-N / seg-N / wave-N)', '='.repeat(64)];
  const head = 'метка'.padEnd(14) + 'карт.'.padStart(6) + 'заход.'.padStart(7) + 'токены'.padStart(12) +
    'cache-read'.padStart(12) + 'сек'.padStart(8) + 'обороты'.padStart(8) + 'возвр.'.padStart(7) + '  подготовка';
  for (const [name, title] of [['route', 'Маршруты'], ['over', 'Надстройки'], ['seg', 'Сегменты'], ['wave', 'Волны']]) {
    if (!t[name].length) continue;
    L.push('', title, head);
    for (const r of t[name]) {
      const unk = [];
      if (r.tokensUnknown) unk.push(`токены unknown: ${r.tokensUnknown}`);
      if (r.cacheUnknown) unk.push(`cache-read unknown: ${r.cacheUnknown}`);
      if (r.secondsUnknown) unk.push(`сек unknown: ${r.secondsUnknown}`);
      const turnsStr = r.turns > 0 ? String(r.turns) : '—';
      L.push(r.key.padEnd(14) + String(r.cards).padStart(6) + String(r.attempts).padStart(7) +
        groups(r.tokens).padStart(12) + groups(r.cacheRead).padStart(12) + groups(r.seconds).padStart(8) +
        turnsStr.padStart(8) + String(r.returns).padStart(7) + '  ' + (r.prepShare == null ? NOT_RECORDED : `${r.prepShare}% (${r.prepNodes})`) +
        (unk.length ? `\n${' '.repeat(14)}${unk.join('; ')} — отдельно, не нулём` : ''));
    }
  }
  L.push('', 'route-4: Kit — исполнитель, подготовкой считается только Spec.');
  L.push('Возвраты — заходы исполнителя (Run; на route-4 — Kit) сверх первого на карточке.');
  return L.join('\n');
}

// ─────────────────────────── знаменатель ───────────────────────────
// Мера полезной работы — ЗАКРЫТАЯ КАРТОЧКА, не сожжённый токен. Соотношение
// «перечитывание / токены» падает и от того, что задача просто стала длиннее.
// ПРАВИЛО ЭТОГО ОТЧЁТА: рядом с каждой величиной стоит её покрытие,
// а величина с нулевым покрытием не считается вовсе — печатается «не записано».
// Ноль и «не записано» уже один раз выглядели одинаково.

const FEATURES_DIR = path.resolve(__dirname, '..', '..', '.devtool', 'features');
const NOT_RECORDED = 'не записано';

function countClosedCards() {
  const dir = path.join(FEATURES_DIR, 'done');
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).length;
  } catch { return 0; }
}

/** Пробелы разрядов — чтобы длинное число читалось глазами, а не пересчитывалось. */
const groups = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Числительное подписи: 1 токен / 2 токена / 5 токенов. */
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}
const tokenWord = (n) => plural(n, 'токен', 'токена', 'токенов');

/**
 * Одна строка отчёта. Единственное место, где решается «число или "не записано"»:
 * решает ПОКРЫТИЕ, а не значение. cover = { done, all } — заходов с величиной из всех.
 */
function metricLine(label, cover, compute, unit) {
  const head = label.padEnd(34);
  const pad = ' '.repeat(34);
  if (!cover.done) {
    return `${head}${NOT_RECORDED}\n${pad}покрытие: ни одного захода из ${groups(cover.all)} — величина не считалась`;
  }
  const share = Math.round((cover.done / cover.all) * 100);
  return `${head}${compute()} ${unit}\n${pad}покрытие: ${groups(cover.done)} из ${groups(cover.all)} (${share}%)`;
}

const wordAttempts = (n) => plural(n, 'заход', 'захода', 'заходов');

/** Шапка: корпус, «токены не вернул движок» и состояние кэш-чтения. */
function corpusLines(c) {
  const L = ['Знаменатель: инструктаж против закрытой работы', '='.repeat(64)];
  L.push(`Корпус: ${groups(c.filesProcessed)} ${plural(c.filesProcessed, 'файл', 'файла', 'файлов')}, ` +
    `${groups(c.attempts)} ${wordAttempts(c.attempts)}, ` +
    `${groups(c.allTokens)} ${tokenWord(c.allTokens)}, закрытых карточек: ${groups(c.closed)}.`);
  if (c.tokensUnknown) L.push(`Токены не вернул движок: ${groups(c.tokensUnknown)} ${wordAttempts(c.tokensUnknown)}; они не приравнены к нулю.`);

  /* ДВА СОСТОЯНИЯ РАЗОМ — норма корпуса, а не поломка отчёта.
     R восстанавливается из стенограммы захода, а у ранних заходов её нет. */
  const withoutCache = c.attempts - c.withCache;
  if (c.withCache && withoutCache) {
    L.push(`Кэш-чтение есть у ${groups(c.withCache)} ${plural(c.withCache, 'захода', 'заходов', 'заходов')} из ${groups(c.attempts)}; ` +
      `у остальных ${groups(withoutCache)} — стенограмма не найдена.`);
    L.push('Это штатно: R берётся из стенограммы захода, а стенограммы живут при сессии —');
    L.push('«не записано» ниже — правда о корпусе, а не сбой счёта.');
  } else if (!c.withCache && c.attempts) {
    L.push(`Кэш-чтение не записано ни у одного из ${groups(c.attempts)} заходов — величины, ` +
      'которые на нём стоят, не считаются вовсе.');
  }
  L.push('');
  return L;
}

// 2. Заходов на закрытую карточку. Печатается ОБРАТНОЙ дробью, когда заходов меньше
// карточек: ведущий ноль читается глазами как «почти ничего».
function attemptsPerCardLines(c) {
  const label = 'заходов на закрытую карточку'.padEnd(34);
  const pad = ' '.repeat(34);
  if (!c.closed || !c.cardsWithAttempt) {
    return [`${label}${NOT_RECORDED}`, `${pad}покрытие: ни одной закрытой карточки с записанным заходом`];
  }
  const value = c.attempts >= c.closed
    ? `${(c.attempts / c.closed).toFixed(1)} захода на карточку`
    : `1 заход на ${(c.closed / c.attempts).toFixed(1)} закрытых карточки`;
  return [
    `${label}${value}`,
    `${pad}покрытие: заход записан в ${groups(c.cardsWithAttempt)} карточках из ${groups(c.closed)} закрытых`,
    `${pad}(${groups(c.attempts)} заходов всего; у остальных карточек расход не записан вовсе,`,
    `${pad}поэтому величина — нижняя граница, а не средняя цена карточки)`,
  ];
}

// 4. Шагов на заход — R, делённое на вес одного шага узла.
function stepsPerAttempt(byNode, weights) {
  const parts = [];
  for (const [node, v] of Object.entries(byNode)) {
    if (!v.withCacheRead || !weights) continue;
    const w = weights().byNode[node];
    if (!w) continue;
    parts.push(`${node} ${(v.cacheRead / v.withCacheRead / w.perStep).toFixed(1)}`);
  }
  return parts.length ? parts.join(', ') : NOT_RECORDED;
}

/** Четыре величины отчёта, каждая с покрытием. */
function metricLines(c, byNode, weights) {
  const cover = { done: c.withCache, all: c.attempts };
  const pad = ' '.repeat(34);
  const L = [];
  // 1. Перечитывание на закрытую карточку — покрытие по заходам с записанным R.
  L.push(metricLine('перечитывание на закрытую карточку', cover,
    () => groups(Math.round(c.cacheRead / Math.max(1, c.closed))), 'токенов'), '');
  L.push(...attemptsPerCardLines(c), '');
  // 3. Доля перечитывания в окне — делится на токены ТЕХ ЖЕ заходов, у которых записан R.
  // Устав — ~4% от R, остальное — заново отправляемая беседа.
  L.push(metricLine('доля перечитывания в окне', cover,
    () => Math.round((c.cacheRead / Math.max(1, c.tokensWithCache)) * 100) + '%', ''));
  L.push(`${pad}(R против токенов тех же заходов; устав — лишь ~4% этой доли,`);
  L.push(`${pad}остальное — заново отправляемая беседа, см. пол ниже)`, '');
  L.push(metricLine('шагов на заход', cover, () => stepsPerAttempt(byNode, weights), 'шагов (оценка)'), '');
  return L;
}

// ПОЛ. Самый быстрый способ уронить долю инструктажа — выкинуть AGENTS.md.
// Поэтому пол называется всегда, даже когда сама доля ещё не считается.
function floorLines(weights) {
  const L = ['-'.repeat(64), 'Пол — ниже него не опускаются, не урезав закон:'];
  if (weights) {
    const w = weights();
    for (const [node, v] of Object.entries(w.byNode)) {
      L.push(`  ${node.padEnd(8)} ${groups(v.perStep)} ${tokenWord(v.perStep)} — это «вес шага × 1», один шаг с законом и ролью.`);
    }
    L.push(`  Из них общая часть (${w.common.files.map((f) => f.file).join(' + ')}): ${groups(w.common.tokens)} ${tokenWord(w.common.tokens)}.`);
    L.push('  Оценка, не измерение (см. instruction-weight.cjs): настоящий вес шага больше.');
  } else {
    L.push('  instruction-weight.cjs недоступен — пол не назван, и это не ноль.');
  }
  L.push('  Инструктаж и есть пятнадцать запретов. Падение доли НИЖЕ пола читается как');
  L.push('  поломка закона, а не как успех оптимизации.', '');
  L.push('Приближение, которое нельзя забыть: дата закрытия карточки нигде не');
  L.push('записывается, поэтому «на закрытую карточку» считается по корпусу целиком,');
  L.push('а окно — по датам заходов. Чинится отдельной карточкой, не этим счётчиком.');
  return L;
}

function unparsedLines(unparsed) {
  if (!unparsed.length) return [];
  return ['', `Похожи на заход, но не разобрались — проверить руками: ${unparsed.length}.`,
    ...unparsed.slice(0, 5).map((s) => `  ${s.file}: ${s.line}`)];
}

function report(targets) {
  const { byNode, total, filesProcessed, cardsWithAttempt, unparsed } = tally(targets);
  // Вес инструкций — дело адаптера движка; нет адаптера — пол назовём как недоступный.
  const weights = engines.first(path.resolve(__dirname, '..', '..'), 'instructionWeight');
  const sum = (key) => Object.values(byNode).reduce((s, v) => s + v[key], 0);
  const c = {
    filesProcessed, cardsWithAttempt, attempts: total.attempts, allTokens: total.tokens,
    tokensUnknown: total.tokensUnknown, closed: countClosedCards(),
    withCache: sum('withCacheRead'), cacheRead: sum('cacheRead'), tokensWithCache: sum('tokensWithCacheRead'),
  };
  return [...corpusLines(c), ...metricLines(c, byNode, weights), ...floorLines(weights), ...unparsedLines(unparsed)].join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--routes')) {
    const rest = argv.filter((a) => a !== '--routes' && a !== '--json');
    const targets = rest.length ? rest : [FEATURES_DIR];
    const text = argv.includes('--json') ? JSON.stringify(byRoute(targets), null, 2) : routeReport(targets);
    process.stdout.write(text + '\n');
    return;
  }
  if (argv.includes('--report')) {
    const rest = argv.filter((a) => a !== '--report');
    const targets = rest.length ? rest : [FEATURES_DIR];
    const missing = targets.filter((a) => !fs.existsSync(a));
    if (missing.length) { console.error('Не найдено: ' + missing.join(', ')); process.exit(1); }
    process.stdout.write(report(targets) + '\n');
    return;
  }
  const args = argv;
  if (args.length === 0) {
    console.error('Использование: node tally.cjs <файл-или-каталог> [...]');
    process.exit(1);
  }
  const missing = args.filter((a) => !fs.existsSync(a));
  if (missing.length) {
    console.error('Не найдено: ' + missing.join(', '));
    process.exit(1);
  }
  const result = tally(args);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

module.exports = { tally, byRoute, readLabels, main };
if (require.main === module) main();
