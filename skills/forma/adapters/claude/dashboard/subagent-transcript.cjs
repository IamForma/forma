#!/usr/bin/env node
'use strict';

/**
 * Стенограмма захода субагента — источник `R`.
 *
 * Полгода строка захода стояла без кэш-чтения, потому что возврат Agent-вызова его
 * не отдаёт: в `<usage>` приходят `subagent_tokens`, `tool_uses`, `duration_ms` — и всё.
 * Развилку сняла находка: у события `SubagentStop` есть поле
 * `agent_transcript_path`, то есть у КАЖДОГО захода субагента своя стенограмма на диске:
 *
 *   <каталог стенограмм проекта>/<sessionId>/subagents/agent-<agent_id>.jsonl
 *   <каталог стенограмм проекта>/<sessionId>/subagents/agent-<agent_id>.meta.json
 *
 * `.meta.json` несёт `agentType`, `description`, `toolUseId`, `spawnDepth`.
 * В `.jsonl` — обычные записи с `message.usage`, оттуда и берутся четыре поля.
 *
 * ТРИ ВЕЩИ, НА КОТОРЫХ ЗДЕСЬ ЛЕГКО ОШИБИТЬСЯ МОЛЧА — те же, что в
 * `session-economy.cjs` адаптера, где метод уже отлажен и сверен с бухгалтерией
 * движка (расхождение 0.25%). Здесь они повторены не из вежливости, а потому что
 * каждая из них однажды дала неверное число:
 *
 * 1. ДЕДУПЛИКАЦИЯ ПО `requestId` — условие верности, а не оптимизация. Одна и та же
 *    запись usage лежит в файле многократно (пересборка веток разговора). На общей
 *    сессии отсутствие дедупликации завышало счёт вдесятеро, и по правдоподобию числа
 *    этого не видно. Замер на `agent-a3f3f8bf86f7eae4f.jsonl`: 24 строки с
 *    `cache_read_input_tokens`, уникальных `requestId` — 11. Одиннадцать и есть шаги.
 * 2. ОТСУТСТВИЕ СТЕНОГРАММЫ — ЭТО НЕ НОЛЬ. Стенограммы живут при сессии: сорок прошлых
 *    заходов их не имеют и не получат никогда. Функция возвращает `null`, и ни один
 *    путь отсюда не возвращает нулей: ведущий ноль читается глазами как «почти
 *    бесплатно» — ровно та ошибка, ради которой заведён знаменатель.
 * 3. ТОЛЬКО ЧТЕНИЕ. Каталог стенограмм движка — чужой. Здесь не пишут ничего.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const economy = require('./economy.cjs');
// Каталог стенограмм и разбор шага `message.usage` в канонические переменные — у адаптера движка
// (граница ядро — адаптер: `lib/engines.cjs`). Нет адаптера — стенограммы нет, это не ноль.
const engines = require('./lib/engines.cjs');

/** Слова, которыми называется отсутствие стенограммы. Одно место на весь проект —
 *  чтобы «ноль» не просочился ни в лог, ни в отчёт, ни в строку захода. */
const NO_TRANSCRIPT = 'стенограмма не найдена';

/** Каталог стенограмм этого проекта — как его находит адаптер движка; адаптера или каталога нет — `null`.
 *  Зашивать сюда путь проекта значит сделать скрипт непереносимым ровно в тот день,
 *  когда плагин «Форма» уедет на другой проект. */
function transcriptDir(root = PROJECT_ROOT) {
  const find = engines.first(root, 'transcriptsDir');
  return find ? find(root) : null;
}

/** Ищет `agent-<id>.jsonl` по всем сессиям проекта. Сессия не задаётся снаружи:
 *  вызывающий знает `agent_id` из возврата вызова и не знает `sessionId`. */
function findTranscript(agentId, root = PROJECT_ROOT) {
  if (!agentId || !/^[A-Za-z0-9_-]+$/.test(agentId)) return null;
  const dir = transcriptDir(root);
  if (!dir) return null;
  let sessions;
  try { sessions = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }

  let newest = null;
  for (const s of sessions) {
    if (!s.isDirectory()) continue;
    const file = path.join(dir, s.name, 'subagents', `agent-${agentId}.jsonl`);
    let st;
    try { st = fs.statSync(file); } catch { continue; }
    if (!st.isFile()) continue;
    /* Один и тот же id теоретически может встретиться в двух сессиях. Берём свежайший:
       строка захода пишется сразу после возврата, то есть про последний заход. */
    if (!newest || st.mtimeMs > newest.mtimeMs) {
      newest = { file, mtimeMs: st.mtimeMs, sessionId: s.name };
    }
  }
  return newest;
}

function readMeta(jsonlFile) {
  const metaFile = jsonlFile.replace(/\.jsonl$/, '.meta.json');
  try { return JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch { return null; }
}

/**
 * Разбор стенограммы потоком. Файл захода невелик (десятки-сотни строк), но метод
 * тот же, что на гигабайтном корпусе общей сессии: дешёвый отсев подстрокой до
 * `JSON.parse`, дедупликация по `requestId`.
 *
 * @returns {Promise<null|{agentId, sessionId, file, agentType, description, toolUseId,
 *   spawnDepth, steps, cacheRead, cacheCreate, input, output, models, first, last}>}
 *   `null` — стенограммы нет. Это НЕ ноль, см. пункт 2 в шапке.
 */
async function readSubagentTranscript(agentId, root = PROJECT_ROOT) {
  const parseUsage = engines.first(root, 'parseUsage');
  if (!parseUsage) return null;
  const found = findTranscript(agentId, root);
  if (!found) return null;

  const seen = new Set();
  const t = economy.emptyUsage();
  const models = new Set();
  let first = null, last = null;

  const rl = readline.createInterface({
    input: fs.createReadStream(found.file),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.includes('cache_read_input_tokens')) continue; // отсев до разбора
    let j;
    try { j = JSON.parse(line); } catch { continue; }
    const u = j.message && j.message.usage;
    if (!u || u.cache_read_input_tokens == null) continue;
    const key = j.requestId || j.uuid; // см. пункт 1 в шапке
    if (seen.has(key)) continue;
    seen.add(key);

    economy.addUsage(t, parseUsage(u));
    if (j.message && j.message.model) models.add(j.message.model);
    if (j.timestamp) { if (!first) first = j.timestamp; last = j.timestamp; }
  }

  // Файл есть, но ни одного шага с usage — это не «ноль расхода», а нечитаемая
  // стенограмма. Называется так же, как её отсутствие, и по той же причине.
  if (!t.calls) return null;

  const meta = readMeta(found.file) || {};
  return {
    agentId,
    sessionId: found.sessionId,
    file: found.file,
    agentType: meta.agentType || null,
    description: meta.description || null,
    toolUseId: meta.toolUseId || null,
    spawnDepth: meta.spawnDepth == null ? null : meta.spawnDepth,
    steps: t.calls,
    cacheRead: t.cache_read,
    cacheCreate: t.cache_write,
    input: t.tokens_in,
    output: t.tokens_out,
    usage: { tokens_in: t.tokens_in, tokens_out: t.tokens_out, cache_read: t.cache_read, cache_write: t.cache_write },
    models: [...models].sort(),
    first, last,
  };
}

module.exports = { readSubagentTranscript, findTranscript, transcriptDir, NO_TRANSCRIPT };

// ---- CLI: node .forma/dashboard/subagent-transcript.cjs <agent_id> [...] ----
if (require.main === module) {
  const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!ids.length) {
    console.error('usage: node .forma/dashboard/subagent-transcript.cjs <agent_id> [<agent_id> ...]');
    process.exit(2);
  }
  (async () => {
    const groups = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    for (const id of ids) {
      const r = await readSubagentTranscript(id);
      if (!r) {
        // Ни числа, ни нуля — только слова.
        console.log(`${id}  ${NO_TRANSCRIPT}`);
        continue;
      }
      console.log(
        `${id}  узел=${r.agentType || '?'}  шагов=${r.steps}  ` +
        `R=${groups(r.cacheRead)}  создание=${groups(r.cacheCreate)}  ` +
        `ввод=${groups(r.input)}  выход=${groups(r.output)}`
      );
    }
  })();
}
