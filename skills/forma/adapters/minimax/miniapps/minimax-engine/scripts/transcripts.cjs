'use strict';

/**
 * Стенограммы движка: где рантайм пишет настоящие числа расхода и как их достать.
 *
 * Рантайм пишет пошаговый расход в стенограмму сессии: `messages.jsonl`, у каждого сообщения
 * ассистента — `usage: {input, output, cacheRead, cacheWrite, totalTokens}` и имя модели.
 * Это единственное место, где числа настоящие: payload хука их не несёт, поэтому хук без
 * этого ридера пишет в журнал `null`, и строка расхода читается `unknown`.
 *
 * Как найти стенограмму по идентификатору сессии: имя каталога сессии — это base64 от её
 * `sessionId` с префиксом времени. Никакого обхода всех сессий: `base64(sessionId)` и есть
 * имя. Обход остаётся запасным путём, если каталог назван иначе.
 *
 * Модуль общий: хук пакета грузит его из `PLUGIN_ROOT`, скрипты зоны — из исходника пакета
 * в проекте. Одна реализация, две стороны.
 *
 * Только чтение. Пишет только хук — нормированную стенограмму в `.minimax/.transcripts/`.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

/** Профиль рантайма: рантайм задаёт `PLUGIN_DATA`, и по нему профиль восстанавливается точно. */
function profileRoot(env = process.env) {
  const data = env.PLUGIN_DATA;
  if (data) {
    // <профиль>/v2/plugin-data/hooks/<плагин> → <профиль>: отрезать четыре сегмента.
    const parts = path.normalize(data).split(path.sep);
    if (parts.length >= 6 && parts[parts.length - 3] === 'plugin-data' && parts[parts.length - 2] === 'hooks') {
      const profile = parts.slice(0, parts.length - 4).join(path.sep);
      if (profile) return profile;
    }
  }
  return path.join(os.homedir(), '.minimax');
}

/** Корень хранилища сессий рантайма. */
function sessionsRoot(env = process.env) {
  return path.join(profileRoot(env), 'v2', 'sessions');
}

/** Имя каталога сессии: время + base64 от `sessionId`. */
function sessionDirName(sessionId) {
  return Buffer.from(String(sessionId), 'utf8').toString('base64');
}

/** Каталог сессии по её идентификатору. Нет — `null` (нет стенограммы, а не ноль). */
function sessionDir(sessionId, env = process.env) {
  if (!sessionId) return null;
  const root = sessionsRoot(env);
  if (!fs.existsSync(root)) return null;

  const b64 = sessionDirName(sessionId);
  // Сначала быстрый путь: имя каталога содержит base64 идентификатора.
  const walk = (dir, depth) => {
    if (depth > 4) return null;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const full = path.join(dir, e.name);
      if (e.name.includes(b64)) return full;
      const hit = walk(full, depth + 1);
      if (hit) return hit;
    }
    return null;
  };
  const byName = walk(root, 0);
  if (byName) return byName;

  // Запасной путь: манифест сессии.
  const byManifest = walk(root, 0);
  if (byManifest) return byManifest;
  try {
    for (const day of fs.readdirSync(root, { withFileTypes: true })) {
      if (!day.isDirectory()) continue;
      const dayDir = path.join(root, day.name);
      for (const s of fs.readdirSync(dayDir, { withFileTypes: true })) {
        if (!s.isDirectory()) continue;
        const manifest = path.join(dayDir, s.name, 'manifest.json');
        if (!fs.existsSync(manifest)) continue;
        try {
          const m = JSON.parse(fs.readFileSync(manifest, 'utf8'));
          if (m.sessionId === sessionId) return path.join(dayDir, s.name);
        } catch {
          /* манифест не читается — идём дальше */
        }
      }
    }
  } catch {
    /* хранилища нет */
  }
  return null;
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Шаги сессии: сообщения ассистента с расходом.
 * @returns {Array<{turnId, model, timestamp, input, output, cacheRead, cacheWrite}>}
 */
function readSteps(sessionId, env = process.env) {
  const dir = sessionDir(sessionId, env);
  if (!dir) return [];
  const file = path.join(dir, 'messages.jsonl');
  if (!fs.existsSync(file)) return [];
  const steps = [];
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes('"usage"')) continue;
    let j;
    try {
      j = JSON.parse(line);
    } catch {
      continue;
    }
    const m = j.message || {};
    if (m.role !== 'assistant' || !m.usage) continue;
    steps.push({
      turnId: j.turn_id || null,
      model: m.model || null,
      timestamp: m.timestamp || null,
      input: num(m.usage.input),
      output: num(m.usage.output),
      cacheRead: num(m.usage.cacheRead),
      cacheWrite: num(m.usage.cacheWrite),
    });
  }
  return steps;
}

/**
 * Расход сессии целиком.
 * @returns {null|{input, output, cache_read, cache_write, model, calls}}
 *   `null` — стенограммы нет или в ней нет расхода. Это не ноль.
 */
function readUsage(sessionId, env = process.env) {
  const steps = readSteps(sessionId, env);
  if (!steps.length) return null;
  const sum = (k) => {
    let total = 0;
    let known = false;
    for (const s of steps) {
      if (s[k] === null) continue;
      total += s[k];
      known = true;
    }
    return known ? total : null;
  };
  const models = {};
  for (const s of steps) if (s.model) models[s.model] = (models[s.model] || 0) + 1;
  const model = Object.entries(models).sort((a, b) => b[1] - a[1])[0];
  return {
    input: sum('input'),
    output: sum('output'),
    cache_read: sum('cacheRead'),
    cache_write: sum('cacheWrite'),
    model: model ? model[0] : null,
    calls: steps.length,
  };
}

/**
 * Нормированная стенограмма — в форме, которую читает ядро (`cache_read_input_tokens`,
 * `message.model`, `requestId`): дашборд считает по ней пол окна и разрезы по моделям.
 */
function normalizedLines(steps) {
  return steps
    .filter((s) => s.input !== null || s.output !== null || s.cacheRead !== null)
    .map((s, i) =>
      JSON.stringify({
        requestId: s.turnId || `step-${i}`,
        timestamp: s.timestamp || null,
        message: {
          role: 'assistant',
          model: s.model || 'unknown',
          usage: {
            input_tokens: s.input === null ? 0 : s.input,
            output_tokens: s.output === null ? 0 : s.output,
            cache_read_input_tokens: s.cacheRead === null ? 0 : s.cacheRead,
            cache_creation_input_tokens: s.cacheWrite === null ? 0 : s.cacheWrite,
          },
        },
      })
    )
    .join('\n');
}

/**
 * Нормированная стенограмма для чтения ядром (`card-move.cjs --agent-id`): та же форма,
 * но `requestId` уникален на ШАГ, а не на ход. Ядро дедуплицирует шаги одного ответа по
 * `requestId` (у Claude один ответ API пишется несколькими строками) — значит, один шаг
 * рантайма должен быть одной строкой со своим ключом, иначе ядро посчитает только первый шаг хода.
 */
function coreLines(steps) {
  return steps
    .filter((s) => s.input !== null || s.output !== null || s.cacheRead !== null)
    .map((s, i) =>
      JSON.stringify({
        requestId: `${s.turnId || 'turn'}-${i}`,
        timestamp: s.timestamp || null,
        message: {
          role: 'assistant',
          model: s.model || 'unknown',
          usage: {
            input_tokens: s.input === null ? 0 : s.input,
            output_tokens: s.output === null ? 0 : s.output,
            cache_read_input_tokens: s.cacheRead === null ? 0 : s.cacheRead,
            cache_creation_input_tokens: s.cacheWrite === null ? 0 : s.cacheWrite,
          },
        },
      })
    )
    .join('\n');
}

module.exports = {
  profileRoot,
  sessionsRoot,
  sessionDirName,
  sessionDir,
  readSteps,
  readUsage,
  normalizedLines,
  coreLines,
};
