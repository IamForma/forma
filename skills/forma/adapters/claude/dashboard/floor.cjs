#!/usr/bin/env node
'use strict';

/**
 * ПОЛ ОКНА — сколько стоит один вызов ДО того, как в нём что-либо произошло.
 *
 * Пол сессии = минимальный размер окна среди её вызовов, где размер окна —
 *   cache_read_input_tokens + cache_creation_input_tokens + input_tokens.
 * Минимум, а не среднее, и не первый вызов: окно только растёт по ходу сессии, поэтому
 * самый дешёвый вызов и есть тот, в котором лежит один инструктаж — закон, роль,
 * объявленные инструменты, память, системный промпт движка — и почти ничего сверх.
 *
 * ЗАЧЕМ ЭТО МЕРЯЕТСЯ ЛИНИЕЙ, А НЕ ОДНИМ ЧИСЛОМ. Величина пола сама по себе ни о чём не
 * говорит и обманывает: за два месяца в проект приехали пять ролей, четырнадцать скиллов,
 * шестьдесят записей памяти и граф опыта — а пол сдвинулся на несколько тысяч и вернулся
 * обратно. Значит он почти целиком не наш, и подрезать в нём нечего. Смысл в НАКЛОНЕ:
 * линия ловит день, когда кто-то подключит сервер на двести инструментов, и ловит его
 * назавтра, а не через квартал по счёту.
 *
 * ТРИ ВЕЩИ, НА КОТОРЫХ ЗДЕСЬ ЛЕГКО ОШИБИТЬСЯ МОЛЧА — те же, что в
 * `session-economy.cjs` адаптера и `.forma/dashboard/subagent-transcript.cjs`:
 *
 * 1. ДЕДУПЛИКАЦИЯ ПО `requestId`. Одна и та же запись usage лежит в файле многократно
 *    (пересборка веток разговора). На минимуме это не так больно, как на сумме, но
 *    счётчик вызовов без неё завышается вдесятеро и «пол посчитан по 40 вызовам»
 *    перестаёт значить то, что написано.
 * 2. ПОТОКОВОЕ ЧТЕНИЕ, НЕ `readFileSync`. Стенограммы общей сессии — сотни мегабайт,
 *    больше предела строки в Node: обычное чтение целиком на них падает. Отсюда
 *    `readline` и дешёвый отсев подстрокой до `JSON.parse`.
 * 3. МОДЕЛЬ ИМЕЕТ ЗНАЧЕНИЕ. В стенограмме рядом с рабочими вызовами лежат служебные
 *    (заголовок беседы, мелкие подсказки) — они идут на дешёвой модели с крошечным
 *    окном, и минимум по всем моделям разом дал бы пол в сотни токенов вместо
 *    семидесяти тысяч. Пол считается по ГОСПОДСТВУЮЩЕЙ модели сессии (по числу
 *    вызовов); минимум по всем моделям тоже сохраняется — `floorAnyModel`, чтобы
 *    расхождение было видно, а не пряталось в фильтре.
 *
 * ТОЛЬКО ЧТЕНИЕ. Каталог стенограмм движка — чужой, здесь не пишут ничего;
 * пишется единственный свой файл — `.forma/dashboard/.cache/floor.json`.
 *
 * Запуск: node .forma/dashboard/floor.cjs            — посчитать и записать кэш
 *         node .forma/dashboard/floor.cjs --print    — то же и напечатать таблицу
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { transcriptDir } = require('./subagent-transcript.cjs');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/** Слова, которыми называется отсутствие стенограмм. Ни один путь отсюда не возвращает
 *  нуля: ведущий ноль читается глазами как «окно бесплатное» — ровно наоборот. */
const NO_TRANSCRIPTS = 'стенограмм проекта не найдено';

/**
 * Одна стенограмма → пол. Потоком, с дедупликацией.
 * @returns {Promise<null|{calls, floor, model, floorAnyModel, anyModel, first, last}>}
 *   `null` — в файле нет ни одного вызова с usage. Это не ноль, а нечитаемая стенограмма.
 */
async function parseFloor(file) {
  const seen = new Set();
  // Минимум и число вызовов держатся ПОМОДЕЛЬНО — иначе служебная модель утянет пол вниз.
  const byModel = new Map(); // model -> { calls, min }
  let anyMin = null, anyModel = null;
  let first = null, last = null;

  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.includes('cache_read_input_tokens')) continue; // отсев до разбора
    let j;
    try { j = JSON.parse(line); } catch { continue; }
    const u = j.message && j.message.usage;
    if (!u || u.cache_read_input_tokens == null) continue;
    const key = j.requestId || j.uuid;
    if (seen.has(key)) continue;
    seen.add(key);

    const window = u.cache_read_input_tokens
      + (u.cache_creation_input_tokens || 0)
      + (u.input_tokens || 0);

    const model = (j.message && j.message.model) || 'unknown';
    let m = byModel.get(model);
    if (!m) byModel.set(model, (m = { calls: 0, min: window }));
    m.calls += 1;
    if (window < m.min) m.min = window;

    if (anyMin == null || window < anyMin) { anyMin = window; anyModel = model; }
    if (j.timestamp) { if (!first) first = j.timestamp; last = j.timestamp; }
  }
  rl.close();

  if (!byModel.size) return null;

  // Господствующая модель — та, на которой сессия работала, а не та, что мелькнула.
  const [model, dom] = [...byModel.entries()].sort((a, b) => b[1].calls - a[1].calls)[0];
  return {
    calls: [...byModel.values()].reduce((s, m) => s + m.calls, 0),
    callsOnModel: dom.calls,
    floor: dom.min,
    model,
    floorAnyModel: anyMin,
    anyModel,
    first, last,
  };
}

/**
 * Обход стенограмм проекта. Кэш по `sessionId` + размер + mtime: закрытая сессия
 * больше не меняется, и перечитывать её сотни мегабайт на каждой сборке дашборда
 * незачем. Живая сессия растёт — у неё меняется размер, и она пересчитывается.
 */
async function build(root = PROJECT_ROOT) {
  const dir = transcriptDir(root);
  const cacheFile = path.join(root, '.forma/dashboard', '.cache', 'floor.json');

  if (!dir) {
    return { generatedAt: new Date().toISOString(), unavailable: NO_TRANSCRIPTS, sessions: [], byDate: [] };
  }

  let prev = {};
  try { prev = (JSON.parse(fs.readFileSync(cacheFile, 'utf8')).cache) || {}; } catch { /* нет кэша — посчитаем всё */ }
  const cache = {};

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  const sessions = [];
  for (const f of files) {
    const full = path.join(dir, f);
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    const sessionId = f.replace(/\.jsonl$/, '');
    const hit = prev[sessionId];
    let row;
    if (hit && hit.size === st.size && hit.mtimeMs === st.mtimeMs) {
      row = hit.row;
    } else {
      row = await parseFloor(full);
    }
    cache[sessionId] = { size: st.size, mtimeMs: st.mtimeMs, row };
    if (!row) continue; // нечитаемая стенограмма — не ноль, просто нет строки
    sessions.push({ sessionId, date: (row.first || '').slice(0, 10) || null, ...row });
  }

  sessions.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // Линия по датам. Две сессии в один день — берётся нижняя: пол дня это самый
  // дешёвый вызов дня, а не их среднее.
  const byDateMap = new Map();
  for (const s of sessions) {
    if (!s.date) continue;
    const d = byDateMap.get(s.date);
    if (!d || s.floor < d.floor) byDateMap.set(s.date, { date: s.date, floor: s.floor, sessions: (d ? d.sessions : 0) + 1 });
    else d.sessions += 1;
  }
  const byDate = [...byDateMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  const floors = byDate.map((d) => d.floor);
  return {
    generatedAt: new Date().toISOString(),
    unavailable: sessions.length ? null : NO_TRANSCRIPTS,
    sessionCount: sessions.length,
    min: floors.length ? Math.min(...floors) : null,
    max: floors.length ? Math.max(...floors) : null,
    // Сдвиг от первого замера к последнему — то единственное, ради чего линия и нужна.
    drift: floors.length > 1 ? floors[floors.length - 1] - floors[0] : null,
    sessions,
    byDate,
    cache,
  };
}

module.exports = { build, parseFloor, NO_TRANSCRIPTS };

// ---- CLI ----
if (require.main === module) {
  (async () => {
    const data = await build();
    const outDir = path.join(PROJECT_ROOT, '.forma/dashboard', '.cache');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'floor.json'), JSON.stringify(data, null, 2), 'utf8');

    const groups = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    if (data.unavailable) {
      console.log(data.unavailable);
    } else {
      console.log('Пол окна по сессиям проекта — минимальный размер вызова (R + создание + ввод)\n');
      for (const s of data.sessions) {
        const note = s.floorAnyModel !== s.floor
          ? `   (минимум по всем моделям ${groups(s.floorAnyModel)} на ${String(s.anyModel).split('-').slice(0, 2).join('-')} — служебные вызовы, в пол не берутся)`
          : '';
        console.log(`${s.date || '????-??-??'}  ${String(groups(s.floor)).padStart(9)}  ` +
          `вызовов ${String(s.callsOnModel).padStart(5)}  ${s.model}${note}`);
      }
      console.log(`\nсессий: ${data.sessionCount}; ниже всего ${groups(data.min)}, выше всего ${groups(data.max)}; ` +
        `сдвиг от первой к последней ${data.drift > 0 ? '+' : ''}${groups(data.drift)}`);
      console.log('Читается наклон, а не величина: пол почти целиком — собственный промпт движка.');
    }
    console.log(`\n→ .forma/dashboard/.cache/floor.json`);
  })();
}
