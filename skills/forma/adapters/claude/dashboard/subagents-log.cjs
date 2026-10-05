#!/usr/bin/env node
// Учёт расхода постоянных субагентов — companion к AGENTS.md §3 «заход» в карточке,
// но сквозь всю жизнь субагента, не по одной задаче (`kit.md`-задача «учёт расхода
// постоянных субагентов», память project_kit_subagent_infra_housekeeping.md).
//
// Критический факт: subagent_tokens в <usage> —
// нарастающий итог за всю жизнь субагента (текущий размер контекста), не расход за
// вызов. Поэтому каждая запись хранит и использует ДЕЛЬТУ (текущее сырое значение минус
// предыдущее сохранённое), не само сырое число — иначе расход задваивается на весь
// предыдущий контекст. См. .forma/dashboard/subagents.log — формат там же, подробно.
//
// Пишет тот же узел, что и так пишет строку в ## History карточки — не отдельный
// процесс: одна операция сразу после возврата из Agent-вызова.
//
// КЭШ-ЧТЕНИЕ (R, AGENTS.md §3) добавлен позже. Про cache_read_input_tokens
// НЕЛЬЗЯ повторять на веру то, что установлено про subagent_tokens. Измерено
// По живой стенограмме сессии (12 последовательных шагов узла):
// пошаговое cache_read_input_tokens — НЕ нарастающая сумма прежних чтений
// (28049 → 72904, а сумма двух первых дала бы 56098), а размер закэшированного
// префикса на этом шаге, ровно cr(n+1) = cr(n) + cc(n), шесть пар подряд без
// исключений. Отсюда следует ровно одно, и не больше: поле не сбрасывается и не
// убывает в течение жизни субагента.
//
// Чем это НЕ является: доказательством, что величина R целого Agent-вызова —
// снимок (тогда верна дельта, как у токенов) или сумма по шагам (тогда верно сырое
// число). Изнутри узла <usage> собственного вызова не виден, и выдумывать здесь
// нечего. Поэтому природа не объявляется, а устанавливается данными:
//   • по умолчанию считается дельта — как у токенов;
//   • отрицательная дельта у поля, которое измеренно не убывает, — это ДОКАЗАТЕЛЬСТВО
//     того, что величина вызова позаходная, а не снимок. Тогда запись не молчит и не
//     клэмпит в ноль: природа фиксируется в реестре как `позаходное`, расходом
//     засчитывается сырое число, и строка лога это говорит.
// Пока двух записей нет, природа честно стоит как `не установлена`.
//
// ИСТОЧНИК R. Всё рассуждение выше — про R, добытое из
// возврата вызова, где его как раз нет. Теперь есть второй путь, и он лучше первого:
// у каждого захода субагента своя стенограмма на диске (`subagent-transcript.cjs`),
// и там R лежит по шагам. Сумма по дедуплицированным шагам — это расход ИМЕННО ЭТОГО
// захода, а не нарастающий итог; значит дельту считать не надо и природу устанавливать
// не надо — она известна из устройства источника. Путь через `--raw-cache-read`
// оставлен как был: он не мешает и пригодится, если движок однажды начнёт отдавать поле.
//
// Отсутствие стенограммы НИКОГДА не становится нулём — ни в логе, ни в реестре, ни в
// строке §3. Сорок прошлых заходов её не имеют и не получат: стенограммы живут при
// сессии. Это норма корпуса, а не недоделка, и называется словами.
//
// CLI:      node .forma/dashboard/subagents-log.cjs record --agent <id> --role "<текст>"
//             --raw-tokens <N> --duration-s <T> [--raw-cache-read <R>] [--from-transcript]
//             [--card <id>] --summary "<текст>" [--node <Узел>] [--date <ГГГГ-ММ-ДД>]
// Программно: const { recordSubagentCall, historyLine } = require('./subagents-log.cjs');

const fs = require('fs');
const path = require('path');
const { readSubagentTranscript, NO_TRANSCRIPT } = require('./subagent-transcript.cjs');
const { readJson, writeJsonAtomic } = require('./lib/fs.cjs');
const { parseOptions } = require('./lib/cli.cjs');

const ROOT = __dirname;
const CACHE_DIR = path.join(ROOT, '.cache');
const LOG_FILE = path.join(ROOT, 'subagents.log');
const REGISTRY_FILE = path.join(CACHE_DIR, 'subagents-registry.json');

// Тот же casual-формат времени, что и graphify.log/build-done-cards-graph.cjs:
// ГГГГ-ММ-ДД ЧЧ:ММ (срез ISO без строгого учёта часового пояса) — консистентно с
// .forma/dashboard/generate.js:timeAgo(), который эту же форму и парсит.
function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

function readRegistry() {
  return readJson(REGISTRY_FILE, {});
}

// Дельта токенов: первая запись — сырое число, дальше — разность с прошлым сырым.
function tokenDelta(existing, rawTokens) {
  if (!existing) return { first: true, delta: rawTokens, warning: '' };
  const delta = rawTokens - existing.last_raw_subagent_tokens;
  if (!(delta < 0)) return { first: false, delta, warning: '' };
  // Не должно происходить у живого субагента (только сброс/переиспользование id) —
  // не выдумываем отрицательный или произвольный расход: дельта 0, честная пометка
  // в самой строке лога, ничего не скрываем молча.
  return { first: false, delta: 0, warning: ' (предупреждение: сырое subagent_tokens уменьшилось — дельта обнулена, возможен сброс контекста субагента)' };
}

// Сырое cache_read вызова против прошлого сохранённого: дельта, первая запись или
// доказанная убыванием позаходность. Меняет `r` на месте.
function applyRawCacheRead(r, o, existing) {
  const prev = existing ? existing.last_raw_cache_read : undefined;
  if (!Number.isFinite(prev)) {
    r.cacheFirst = true;
    r.cacheDelta = o.rawCacheRead;
    // Одной записи мало, чтобы что-то утверждать: природа остаётся неустановленной.
  } else if (o.rawCacheRead >= prev) {
    r.cacheDelta = o.rawCacheRead - prev;
    if (r.cacheNature === 'не установлена') r.cacheNature = 'накопительное (не опровергнуто)';
  } else {
    // Измеренный факт: пошагово это поле не убывает. Значит убывание величины
    // ВЫЗОВА доказывает, что она позаходная, а не снимок. Не клэмпим в ноль —
    // это ровно тот «приятный нам» перекос, ради которого карточка заведена.
    r.cacheNature = 'позаходное (доказано убыванием)';
    r.cacheDelta = o.rawCacheRead;
    r.warning += ` (природа cache_read установлена как позаходная: сырое ${o.rawCacheRead} меньше предыдущего ${prev}, а пошагово это поле не убывает — расходом засчитано сырое число, не дельта)`;
  }
}

// ---- кэш-чтение (R) ----
// Дельта по умолчанию, но природа поля не объявляется
// задним числом: её устанавливает первое же наблюдение, которое ей противоречит.
function cacheReading(o, existing) {
  const r = {
    cacheDelta: null,
    cacheNature: (existing && existing.cache_read_nature) || 'не установлена',
    cacheFirst: false,
    warning: '',
    // Стенограмма даёт R прямо за этот заход — сумму по дедуплицированным шагам.
    // Природа тут не «устанавливается наблюдением», она следует из устройства источника,
    // поэтому вся машинерия дельты ниже обходится, а не подправляется.
    fromTranscript: Number.isFinite(o.cacheReadFinal),
  };
  r.hasCache = r.fromTranscript || Number.isFinite(o.rawCacheRead);
  if (r.fromTranscript) {
    r.cacheDelta = o.cacheReadFinal;
    r.cacheNature = 'позаходное (по стенограмме)';
  } else if (r.hasCache) {
    applyRawCacheRead(r, o, existing);
  }
  return r;
}

// Прежнее значение счётчика реестра; нет записи или поля — 0.
const carried = (existing, key) => (existing && existing[key] ? existing[key] : 0);

function registryEntry(o, existing, { at, role, delta, cache }) {
  return {
    role,
    hired_at: existing ? existing.hired_at : at,
    last_used_at: at,
    calls: (existing ? existing.calls : 0) + 1,
    tokens_total: (existing ? existing.tokens_total : 0) + delta,
    last_raw_subagent_tokens: o.rawTokens,
    cache_read_total: carried(existing, 'cache_read_total') + (cache.cacheDelta || 0),
    calls_with_cache_read: carried(existing, 'calls_with_cache_read') + (cache.hasCache ? 1 : 0),
    // Заход по стенограмме сырого поля не приносит — и не должен затирать прежнее
    // прочерком: это тот же ноль, только в реестре.
    last_raw_cache_read: Number.isFinite(o.rawCacheRead) ? o.rawCacheRead : (existing ? existing.last_raw_cache_read : undefined),
    cache_read_nature: cache.cacheNature,
    // Шаги и выход берутся только из стенограммы; заход без неё их не имеет, и
    // покрытие считается отдельно от числа заходов — иначе неполнота записи снова
    // станет неотличима от дешевизны.
    steps_total: carried(existing, 'steps_total') + (Number.isFinite(o.steps) ? o.steps : 0),
    output_total: carried(existing, 'output_total') + (Number.isFinite(o.outputTokens) ? o.outputTokens : 0),
    calls_with_transcript: carried(existing, 'calls_with_transcript') + (cache.fromTranscript ? 1 : 0),
  };
}

function appendLogLine(o, { at, role, card, delta, first, cache, warning }) {
  const firstTag = first ? ' | first=true' : '';
  const cacheTag = cache.hasCache
    ? ` | cache_read=${cache.cacheDelta}${cache.cacheFirst ? ' | cache_read_first=true' : ''} | cache_read_nature=${cache.cacheNature}`
    // Отсутствие R называется словами прямо в строке лога. Пустое место читалось бы
    // как ноль ровно так же, как цифра 0, — и уже читалось.
    : ` | cache_read=${NO_TRANSCRIPT}`;
  const stepsTag = Number.isFinite(o.steps) ? ` | steps=${o.steps}` : '';
  const outTag = Number.isFinite(o.outputTokens) ? ` | output=${o.outputTokens}` : '';
  const line = `${at} | agent=${o.agent} | role=${role || '?'} | tokens=${delta}${cacheTag}${stepsTag}${outTag} | duration_s=${o.durationS}${firstTag} | card=${card} | ${o.summary}${warning}\n`;
  fs.appendFileSync(LOG_FILE, line, 'utf8');
}

/**
 * Одна операция: считает дельту, дописывает строку в .forma/dashboard/subagents.log,
 * обновляет .forma/dashboard/.cache/subagents-registry.json. Вызывать сразу после того, как
 * тот же узел уже написал строку захода в ## History карточки (AGENTS.md §3).
 *
 * @param {object} o
 * @param {string} o.agent — id постоянного субагента (напр. "a48ea883239bba084")
 * @param {string} [o.role] — специфика человекочитаемо; обязателен на первой записи,
 *   на последующих — если не передан, сохраняется прежний из реестра
 * @param {number} o.rawTokens — сырое subagent_tokens из этого вызова (нарастающий итог)
 * @param {number} [o.rawCacheRead] — сырое cache_read_input_tokens этого вызова (R, §3)
 * @param {number} [o.cacheReadFinal] — R этого захода, уже посчитанный по стенограмме
 *   (сумма по дедуплицированным шагам). Величина позаходная по устройству источника —
 *   дельта к ней не применяется. Побеждает `rawCacheRead`, если переданы оба.
 * @param {number} [o.steps] — число шагов захода по стенограмме (уникальных requestId)
 * @param {number} [o.outputTokens] — выход модели за заход по стенограмме
 * @param {string} [o.agentId] — опознаватель вызова для строки §3; по умолчанию `o.agent`
 * @param {number} o.durationS — длительность этого вызова, секунды (целое)
 * @param {string} [o.card] — id карточки, если заход привязан к одной; иначе '-'
 * @param {string} o.summary — одна фраза, что сделано
 * @returns {{delta:number, first:boolean, tokensTotal:number}}
 */
function recordSubagentCall(o) {
  if (!o || !o.agent || !Number.isFinite(o.rawTokens) || !Number.isFinite(o.durationS) || !o.summary) {
    throw new Error('recordSubagentCall: обязательны agent, rawTokens (число), durationS (число), summary');
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const registry = readRegistry();
  const at = nowStamp();
  const card = o.card || '-';
  const existing = registry[o.agent];

  const { first, delta, warning: deltaWarning } = tokenDelta(existing, o.rawTokens);
  const cache = cacheReading(o, existing);
  const role = o.role || (existing && existing.role) || null;
  registry[o.agent] = registryEntry(o, existing, { at, role, delta, cache });
  writeJsonAtomic(REGISTRY_FILE, registry);

  appendLogLine(o, { at, role, card, delta, first, cache, warning: deltaWarning + cache.warning });

  const history = o.node
    ? historyLine({
        node: o.node, date: o.date, tokens: delta, cacheRead: cache.cacheDelta,
        durationS: o.durationS, agentId: o.agentId || o.agent, summary: o.summary,
      })
    : null;

  return {
    delta, first, tokensTotal: registry[o.agent].tokens_total,
    cacheDelta: cache.cacheDelta, cacheNature: cache.cacheNature, cacheFirst: cache.cacheFirst, fromTranscript: cache.fromTranscript,
    steps: Number.isFinite(o.steps) ? o.steps : null,
    outputTokens: Number.isFinite(o.outputTokens) ? o.outputTokens : null,
    history,
  };
}

/**
 * Строка `## История` формата AGENTS.md §3, собранная целиком — все четыре величины
 * блока расхода сразу, чтобы ни одну не приходилось дописывать руками и терять
 *:
 *
 *   `Node`, YYYY-MM-DD: attempt, N tokens (R cache-read), T s, `agent_id` — что сделано.
 *
 * Ключевая часть — всегда по-английски, при любом языке проекта; описание —
 * на языке карточки. `sync-engines --check` называет русскую ключевую часть после дня введения правила.
 *
 * Порядок полей не вкусовой: `sync-engines.cjs` ждёт опознаватель последним в блоке
 * расхода, вплотную перед тире (`checkAgentId`, HAS_ID = /,\s*`?[0-9a-f]{8,}`?\s*—/),
 * а кэш-чтение — в скобках сразу за токенами (`checkAttemptFormat`). Сдвинуть любое из
 * двух значит пройти глазами и не пройти проверку.
 *
 * Величины НЕТ — сегмента нет вовсе. Ни нуля, ни прочерка: и то и другое читается как
 * «почти бесплатно», а `tally.cjs` по отсутствию сегмента печатает «не записано».
 * Именно так выглядит заход, чья стенограмма не найдена.
 */
function historyLine({ node, date, tokens, cacheRead, durationS, agentId, summary }) {
  const d = date || new Date().toISOString().slice(0, 10);
  const cache = Number.isFinite(cacheRead) ? ` (${cacheRead} cache-read)` : '';
  const secs = Number.isFinite(durationS) ? `, ${durationS} s` : '';
  const id = agentId ? `, \`${agentId}\`` : '';
  const text = String(summary || '').trim().replace(/\.*$/, '');
  return `- \`${node}\`, ${d}: attempt, ${tokens} tokens${cache}${secs}${id} — ${text}.`;
}

/**
 * Записать заход, взяв R, выход и шаги из стенограммы по `agent_id`.
 * Вызывающему остаётся то, что стенограмма не знает: сырые `subagent_tokens`,
 * длительность и одна фраза о сделанном.
 *
 * Стенограммы нет — запись всё равно происходит, но БЕЗ выдуманного нуля: R в строку
 * §3 не попадает, лог говорит «стенограмма не найдена», и в возврате стоит
 * `transcriptMissing: true`. Это штатное состояние для ранних заходов.
 */
async function recordSubagentCallFromTranscript(o) {
  const t = await readSubagentTranscript(o.agent);
  return {
    ...recordSubagentCall({
      ...o,
      cacheReadFinal: t ? t.cacheRead : undefined,
      steps: t ? t.steps : undefined,
      outputTokens: t ? t.output : undefined,
      role: o.role || (t && (t.description || t.agentType)) || undefined,
    }),
    transcript: t,
    transcriptMissing: !t,
  };
}

module.exports = {
  recordSubagentCall, recordSubagentCallFromTranscript, historyLine,
  readSubagentTranscript, NO_TRANSCRIPT,
};

// ---- CLI ----
if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv[0] !== 'record') {
    console.error('usage: node .forma/dashboard/subagents-log.cjs record --agent <id> --role "<текст>" --raw-tokens <N> --duration-s <T> [--raw-cache-read <R>] [--from-transcript] [--card <id>] --summary "<текст>" [--node <Узел>] [--date <ГГГГ-ММ-ДД>]');
    process.exit(2);
  }
  // Флаг без значения (`--from-transcript`) не должен проглатывать следующий аргумент:
  // иначе `--from-transcript --card <код>` молча теряет карточку.
  const args = parseOptions(argv.slice(1));
  if (!args.agent || args['raw-tokens'] === undefined || args['duration-s'] === undefined || !args.summary) {
    console.error('Обязательны: --agent --raw-tokens --duration-s --summary');
    process.exit(2);
  }
  const payload = {
    agent: args.agent,
    role: typeof args.role === 'string' ? args.role : undefined,
    rawTokens: Number(args['raw-tokens']),
    rawCacheRead: args['raw-cache-read'] === undefined ? undefined : Number(args['raw-cache-read']),
    durationS: Number(args['duration-s']),
    card: typeof args.card === 'string' ? args.card : undefined,
    summary: args.summary,
    node: typeof args.node === 'string' ? args.node : undefined,
    date: typeof args.date === 'string' ? args.date : undefined,
    agentId: typeof args['agent-id'] === 'string' ? args['agent-id'] : undefined,
  };

  (async () => {
    try {
      // По умолчанию R берётся из стенограммы: это единственный путь, который у нас
      // вообще работает. `--no-transcript` оставлен для случая, когда R передан руками.
      const wantTranscript = args['no-transcript'] !== true && args['raw-cache-read'] === undefined;
      const result = wantTranscript
        ? await recordSubagentCallFromTranscript(payload)
        : recordSubagentCall(payload);

      console.log(`Записано: agent=${args.agent} дельта=${result.delta}${result.first ? ' (первая запись)' : ''}, tokens_total=${result.tokensTotal}`);
      if (result.cacheDelta !== null) {
        console.log(`Кэш-чтение: ${result.cacheDelta}${result.cacheFirst ? ' (первая запись)' : ''}, природа поля: ${result.cacheNature}`);
        if (result.steps !== null) {
          console.log(`По стенограмме: шагов ${result.steps}, выход ${result.outputTokens} токенов.`);
        }
      } else if (result.transcriptMissing) {
        // Ровно те слова, и никакого числа рядом: ведущий ноль здесь читался бы как
        // «заход почти ничего не стоил», а он стоил — просто нечем это прочесть.
        console.log(`Кэш-чтение: ${NO_TRANSCRIPT} для agent=${args.agent} — сегмент R в строку §3 не попадёт.`);
        console.log(`В \`tally.cjs --report\` такой заход даёт «не записано», а не ноль.`);
      } else {
        console.log('Кэш-чтение: не передано (--raw-cache-read) — в строку §3 сегмент не попадёт, и это будет видно как «не записано», не как ноль.');
      }
      if (result.history) console.log('Строка §3 для ## История:\n' + result.history);
    } catch (err) {
      console.error('Ошибка:', err.message);
      process.exit(1);
    }
  })();
}
