'use strict';

/**
 * Журнал вызовов движка MiniMax: сырой факт — единственный источник строки расхода (§3).
 *
 * Контракт 5, честно: СТРОКА выводится, а не пишется руками, — `deriveSpendLineForCall`
 * превращает запись журнала в строку через общий форматтер `.forma/dashboard/spend-line.cjs`.
 * Ядро сверяет журнал с карточкой проверкой `.forma/board/checks/ledger-parity.cjs` — она
 * находит журнал по конвенции: `<каталог адаптера>/.ledger/calls.jsonl`; для моей зоны это
 * `.minimax/.ledger/calls.jsonl`.
 *
 * ЗАПИСЬ — платформенная: её пишет хук пакета плагина (`SubagentStop`), а числа берутся
 * из стенограммы сессии рантайма, где они настоящие. До появления пакета запись писал сам
 * узел командой `--append` — тогда сверка ядра сравнивала слово узла со словом узла.
 * Что это меняет, — в §8 зоны, контракт 5.
 *
 * Пока платформа не пишет запись, в неё кладётся только то, что узел действительно прочитал
 * в возврате вызова; непрочитанное остаётся `unknown`, а не нулём и не догадкой.
 *
 * Формат записи журнала (общий с зеркалом Gemini):
 *   { "timestamp": "2000-01-02T10:00:00.000Z", "conversationId": "…",
 *     "input_tokens": 1200, "output_tokens": 300, "cache_read_tokens": 450, "duration_s": 5 }
 *
 * Запуск:
 *   node .minimax/scripts/sync-ledger.cjs --append '<json-запись>'
 *   node .minimax/scripts/sync-ledger.cjs --derive  '<json-запись>' 'Spec' 'описание'
 *   node .minimax/scripts/sync-ledger.cjs --derive-all 'описание'
 *   node .minimax/scripts/sync-ledger.cjs --backfill
 *   node .minimax/scripts/sync-ledger.cjs --list
 */

const fs = require('fs');
const path = require('path');
const { formatSpendLine, ATTEMPT_FORMAT_RE, toInt } = require('../../.forma/dashboard/spend-line.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const LEDGER = path.join(ROOT, '.minimax', '.ledger', 'calls.jsonl');
const ENGINE_TAG = 'minimax';

/** Файл карточки на доске по номеру. */
function cardFile(num) {
  for (const dir of [path.join(ROOT, '.devtool', 'features'), path.join(ROOT, '.devtool', 'features', 'done')]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith(`card-${num}-`) && f.endsWith('.md')) return path.join(dir, f);
    }
  }
  return null;
}

/**
 * Уже записано в карточке по этому вызову: сумма N, R и O по строкам с его id.
 * Вызов может продолжаться (Contract 4): тогда полная стенограмма больше снимка, и новая
 * строка должна нести только ДЕЛЬТУ — иначе карточка посчитает один и тот же расход дважды.
 */
function accountedInCard(file, callId) {
  if (!file || !fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const re = new RegExp(ATTEMPT_FORMAT_RE.source, 'g');
  let tokens = 0;
  let cache = 0;
  let out = 0;
  let lines = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes('`' + callId + '`')) continue;
    re.lastIndex = 0;
    const m = re.exec(line);
    if (!m) continue;
    tokens += toInt(m[3]);
    if (m[4]) cache += toInt(m[4].replace(/[^\d]/g, ''));
    if (m[5]) out += toInt(m[5].replace(/[^\d]/g, ''));
    lines += 1;
  }
  return lines ? { tokens, cache, out, lines } : null;
}

function readLedger(file = LEDGER) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function appendCall(rec, file = LEDGER) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(rec) + '\n', 'utf8');
  return rec;
}

/**
 * Запись журнала → строка расхода §3. Числа приходят из вызова; неизвестное остаётся
 * маркером `unknown` (не нулём) — форматтер общего ядра так и устроен.
 *
 * Канон ECONOMY.md: N — полный расход вызова, ВКЛЮЧАЯ кэш-чтение:
 *   N = tokens_in + cache_write + cache_read + tokens_out, а работа = N − R.
 * N без кэша ядро читает как «N записано без кэша» и прибавляет R — но только когда R > N.
 * При R ≤ N итог занижался бы, и «работа» (N − R) считалась бы неверно.
 *
 * ЗАПИСЬ ЖУРНАЛА — снимок на момент `SubagentStop`: стенограмма вызова дописывается после
 * остановки, и запись журнала остаётся той, что увидел хук. Поэтому строка расхода берёт
 * числа из ПОЛНОЙ стенограммы вызова, а не из снимка: так стоит весь вызов.
 * Старые записи журнала и строки карточек не переписываются (запрет 5) — расхождение
 * «снимок против полного» проверяется тестом как свойство, а не как ошибка.
 */
function fullUsage(rec) {
  const id = rec.conversationId || rec.call_id;
  if (!id) return null;
  try {
    const reader = require(path.join(ROOT, 'miniapps', 'minimax-engine', 'scripts', 'transcripts.cjs'));
    const u = reader.readUsage(id);
    if (!u || !Number.isFinite(u.input)) return null;
    return {
      input_tokens: u.input,
      output_tokens: u.output,
      cache_read_tokens: u.cache_read,
      cache_write_tokens: u.cache_write,
      model: u.model,
      note: 'числа — из полной стенограммы вызова; запись журнала осталась снимком на момент SubagentStop',
    };
  } catch {
    return null;
  }
}

function deriveSpendLineForCall(rec, node, desc, options = {}) {
  const date = String(rec.timestamp || rec.date || '').slice(0, 10);
  const full = fullUsage(rec);
  const src = full || rec;
  const input = Number.isFinite(src.input_tokens) ? src.input_tokens : null;
  const output = Number.isFinite(src.output_tokens) ? src.output_tokens : null;
  const cacheRead = Number.isFinite(src.cache_read_tokens) ? src.cache_read_tokens : null;
  const cacheWrite = Number.isFinite(src.cache_write_tokens) ? src.cache_write_tokens : null;
  const parts = [input, output, cacheRead, cacheWrite];
  const tokens = parts.every((v) => v !== null) ? parts.reduce((s, v) => s + v, 0) : null;
  const duration = Number.isFinite(rec.duration_s) ? rec.duration_s : null;
  let n = tokens;
  let r = cacheRead;
  let o = output;
  if (options.accounted) {
    // Вызов продолжался: строка несёт только дельту против уже записанного в карточке.
    n = tokens == null ? null : Math.max(0, tokens - options.accounted.tokens);
    r = cacheRead == null ? null : Math.max(0, cacheRead - options.accounted.cache);
    o = output == null ? null : Math.max(0, output - options.accounted.out);
    if (!n && !r && !o) return null; // нового расхода нет
  }
  return formatSpendLine({
    node,
    date,
    tokens: n,
    cache_read: r,
    tokens_out: o,
    duration_s: duration,
    call_id: rec.conversationId || rec.call_id || null,
    engine: ENGINE_TAG,
    desc: desc || '',
  });
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (name) => {
    const i = argv.indexOf('--' + name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
  };
  if (argv[0] === '--append') {
    const rec = JSON.parse(argv[1]);
    appendCall(rec);
    console.log('запись добавлена: ' + JSON.stringify(rec));
    return;
  }
  if (argv[0] === '--derive') {
    const rec = JSON.parse(argv[1]);
    const options = {};
    const cardNum = opt('card');
    if (cardNum) {
      const acc = accountedInCard(cardFile(cardNum), rec.conversationId);
      if (acc) options.accounted = acc;
    }
    const line = deriveSpendLineForCall(rec, argv[2] || 'Run', argv[3] || '', options);
    console.log(line || 'нового расхода нет — строка не выводится');
    return;
  }
  if (argv[0] === '--derive-record') {
    // Запись берётся из журнала по id вызова — без перекладывания JSON через командную строку.
    const id = argv[1];
    const rec = readLedger().find((r) => r.conversationId === id);
    if (!rec) {
      console.log('записи с таким id в журнале нет');
      return;
    }
    const options = {};
    const cardNum = opt('card');
    if (cardNum) {
      const acc = accountedInCard(cardFile(cardNum), rec.conversationId);
      if (acc) options.accounted = acc;
    }
    const line = deriveSpendLineForCall(rec, argv[2] || rec.node || 'Run', argv[3] || '', options);
    console.log(line || 'нового расхода нет — строка не выводится');
    return;
  }
  if (argv[0] === '--derive-all') {
    // Строки расхода по всему журналу: платформенные записи без ручного набора JSON.
    for (const rec of readLedger()) {
      console.log(deriveSpendLineForCall(rec, rec.node || 'Run', argv[1] || ''));
    }
    return;
  }
  if (argv[0] === '--backfill') {
    // Достроить числа записей, у которых они неизвестны. Источник — стенограмма сессии
    // рантайма, тот же, что читает хук: ничего не выдумывается, только подставляется то,
    // что платформа уже посчитала. Заодно пишется нормированная стенограмма — её читает
    // дашборд (пол окна и разрезы по моделям).
    const reader = require(path.join(ROOT, 'miniapps', 'minimax-engine', 'scripts', 'transcripts.cjs'));
    const transcriptsDir = path.join(ROOT, '.minimax', '.transcripts');
    const recs = readLedger();
    let filled = 0;
    let written = 0;
    for (const rec of recs) {
      const steps = reader.readSteps(rec.conversationId);
      if (steps.length) {
        const lines = reader.normalizedLines(steps);
        if (lines) {
          fs.mkdirSync(transcriptsDir, { recursive: true });
          const call = String(rec.conversationId).replace(/[^\w.-]/g, '_');
          fs.writeFileSync(path.join(transcriptsDir, call + '.jsonl'), lines + '\n', 'utf8');
          // Раскладка, которую читает ядро (`card-move.cjs --agent-id` → `readTranscript`):
          // <каталог стенограмм>/<вызов>/subagents/agent-<вызов>.jsonl. Ключ дедупликации —
          // `requestId` — на шаг, иначе ядро, считая один ответ API несколькими строками,
          // возьмёт только первый шаг хода.
          const core = reader.coreLines ? reader.coreLines(steps) : lines;
          const nested = path.join(transcriptsDir, call, 'subagents', `agent-${call}.jsonl`);
          fs.mkdirSync(path.dirname(nested), { recursive: true });
          fs.writeFileSync(nested, core + '\n', 'utf8');
          written += 1;
        }
      }
      if (rec.input_tokens !== null && rec.input_tokens !== undefined) continue;
      const u = reader.readUsage(rec.conversationId);
      if (!u) continue;
      rec.input_tokens = u.input;
      rec.output_tokens = u.output;
      rec.cache_read_tokens = u.cache_read;
      rec.cache_write_tokens = u.cache_write;
      rec.model = u.model;
      rec.note = 'числа — из стенограммы сессии рантайма (достроено)';
      filled += 1;
    }
    if (filled) {
      fs.writeFileSync(LEDGER, recs.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
    }
    console.log(`достроено записей: ${filled} из ${recs.length}; стенограмм записано: ${written}`);
    return;
  }
  if (argv[0] === '--list') {
    for (const rec of readLedger()) console.log(JSON.stringify(rec));
    return;
  }
  console.log('usage: sync-ledger.cjs --append <json> | --derive <json> <node> <desc> | --derive-all <desc> | --list');
  process.exit(2);
}

if (require.main === module) main();

module.exports = { deriveSpendLineForCall, appendCall, readLedger, LEDGER, ENGINE_TAG, accountedInCard, cardFile, fullUsage };
