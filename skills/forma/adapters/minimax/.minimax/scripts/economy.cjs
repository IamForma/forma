'use strict';

/**
 * Экономика движка MiniMax: разбор стенограммы, вес инструктажа, каталог стенограмм.
 *
 * Три функции, которые ядро спрашивает у адаптера (форма — `.forma/dashboard/lib/engines.cjs`):
 *   parseUsage(step)      → { tokens_in, tokens_out, cache_read, cache_write }
 *   transcriptsDir(root)  → каталог стенограмм проекта | null
 *   instructionWeight()   → сколько токенов закона и роли грузится в узел на КАЖДЫЙ шаг
 *
 * Стенограммы моего движка пишет хук плагина в `.minimax/.transcripts/` — по одной
 * JSONL-строке на шаг. Формат шага терпимый: принимаются и общие поля
 * (`tokens_in`/`tokens_out`/`cache_read`), и форма Claude (`usage.input_tokens`).
 * Неизвестное остаётся `null`, а не нулём: §3 запрещает писать ноль числом.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const TRANSCRIPTS = path.join(ROOT, '.minimax', '.transcripts');

// Байт на токен: кириллица в UTF-8 — два байта на букву и дробится чаще латиницы.
const BYTES_PER_TOKEN_LATIN = 4.1;
const BYTES_PER_TOKEN_CYRILLIC = 2.2;

function estimateTokens(text) {
  const cyrillicChars = (text.match(/[Ѐ-ӿ]/g) || []).length;
  const cyrillicBytes = cyrillicChars * 2;
  const totalBytes = Buffer.byteLength(text, 'utf8');
  const latinBytes = Math.max(0, totalBytes - cyrillicBytes);
  return Math.round(latinBytes / BYTES_PER_TOKEN_LATIN + cyrillicBytes / BYTES_PER_TOKEN_CYRILLIC);
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Шаг стенограммы → расход шага. Любое неизвестное поле — null, не 0. */
function parseUsage(step) {
  if (!step || typeof step !== 'object') return null;
  const u = step.usage || step;
  const tokensIn = num(u.tokens_in ?? u.input_tokens ?? u.prompt_tokens);
  const tokensOut = num(u.tokens_out ?? u.output_tokens ?? u.completion_tokens);
  const cacheRead = num(u.cache_read ?? u.cache_read_input_tokens ?? u.cache_read_tokens);
  const cacheWrite = num(u.cache_write ?? u.cache_creation_input_tokens ?? u.cache_write_tokens);
  if (tokensIn === null && tokensOut === null && cacheRead === null && cacheWrite === null) return null;
  return { tokens_in: tokensIn, tokens_out: tokensOut, cache_read: cacheRead, cache_write: cacheWrite };
}

/** Каталог стенограмм проекта. Нет каталога — нет стенограмм (null), а не пустой каталог. */
function transcriptsDir(root = ROOT) {
  const dir = path.join(root, '.minimax', '.transcripts');
  return fs.existsSync(dir) ? dir : null;
}

// Общая часть моего контекста: закон (читается нативно) + мой §8.
const COMMON = ['AGENTS.md', '.minimax/rules/minimax-8.md'];

// Файл роли на узел. On-demand роли сюда не входят: они грузятся по требованию.
const ROLE_FILE = {
  Intent: '.minimax/agents/intent.md',
  Spec: '.minimax/agents/spec.md',
  Kit: '.minimax/agents/kit.md',
  Run: '.minimax/agents/run.md',
  Core: '.minimax/agents/core.md',
};

function weighFile(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  const text = fs.readFileSync(abs, 'utf8');
  return { file: rel, bytes: Buffer.byteLength(text, 'utf8'), tokens: estimateTokens(text) };
}

function instructionWeight() {
  const common = COMMON.map(weighFile).filter(Boolean);
  const commonTokens = common.reduce((s, f) => s + f.tokens, 0);
  const byNode = {};
  for (const [node, rel] of Object.entries(ROLE_FILE)) {
    const role = weighFile(rel);
    if (!role) continue;
    byNode[node] = {
      common: commonTokens,
      role: role.tokens,
      perStep: commonTokens + role.tokens,
      files: [...common.map((f) => f.file), role.file],
    };
  }
  return {
    estimate: true,
    note:
      'Оценка по эвристике «байт на токен», не измерение. Системный промпт рантайма и ' +
      'описания инструментов сюда не входят — настоящий вес шага больше.',
    common: { tokens: commonTokens, files: common },
    byNode,
  };
}

/** Число шагов агента по кэш-чтению захода. Верхняя оценка — см. оговорку выше. */
function stepsFromCacheRead(cacheRead, perStep) {
  if (!cacheRead || !perStep) return null;
  return Number((cacheRead / perStep).toFixed(1));
}

module.exports = { parseUsage, transcriptsDir, instructionWeight, stepsFromCacheRead, estimateTokens, TRANSCRIPTS };
