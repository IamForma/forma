#!/usr/bin/env node
'use strict';

/**
 * Вес инструктажа — сколько токенов закона и роли грузится в узел на КАЖДЫЙ шаг вызова.
 *
 * Зачем. §3 велит писать кэш-чтение (R) каждого захода. R копится по шагам агента:
 * закон входит в input не один раз за заход, а заново на каждом внутреннем шаге.
 * Поэтому R сам по себе не отвечает на вопрос «много ли ушло на инструктаж» —
 * он отвечает только вместе с весом одного шага. Этот скрипт даёт второе число.
 *
 *   R / вес одного шага ≈ число шагов агента
 *   вес одного шага × шаги = весь инструктаж захода
 *
 * ЧЕСТНАЯ ОГОВОРКА, которую нельзя терять по дороге: это ОЦЕНКА, не измерение.
 * Токенизатора здесь нет, счёт идёт по эвристике «байт на токен», и она разная
 * для латиницы и кириллицы. Плюс в реальный input входит ещё системный промпт
 * движка и описания инструментов — их пишем не мы, и отсюда они не видны.
 * Значит настоящий вес шага БОЛЬШЕ посчитанного, а число шагов — ВЕРХНЯЯ оценка.
 *
 * Использование:
 *   node instruction-weight.cjs            → JSON по узлам
 *   node instruction-weight.cjs --human    → таблица для чтения глазами
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

// Общая часть — грузится всем пятерым целиком, без изъятий.
const COMMON = ['AGENTS.md', '.claude/rules/claude-8.md'];

// Файл роли на узел. On-demand-роли (.claude/agents/on-demand/) сюда НЕ входят
// намеренно: они грузятся по требованию, не на каждом заходе, и приписывать их
// постоянному весу значило бы завысить инструктаж у всех узлов разом.
const ROLE_FILE = {
  Intent: '.claude/agents/intent.md',
  Spec: '.claude/agents/spec.md',
  Kit: '.claude/agents/kit.md',
  Run: '.claude/agents/run.md',
  Core: '.claude/agents/core.md',
};

// Байт на токен. Кириллица в UTF-8 занимает два байта на букву и дробится
// на части чаще латиницы — поэтому у неё коэффициент заметно ниже.
const BYTES_PER_TOKEN_LATIN = 4.1;
const BYTES_PER_TOKEN_CYRILLIC = 2.2;

function estimateTokens(text) {
  // Кириллических БУКВ, а не байт: длину в байтах считаем ниже отдельно.
  const cyrillicChars = (text.match(/[Ѐ-ӿ]/g) || []).length;
  const cyrillicBytes = cyrillicChars * 2;
  const totalBytes = Buffer.byteLength(text, 'utf8');
  const latinBytes = Math.max(0, totalBytes - cyrillicBytes);
  return Math.round(latinBytes / BYTES_PER_TOKEN_LATIN + cyrillicBytes / BYTES_PER_TOKEN_CYRILLIC);
}

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
      'Оценка по эвристике «байт на токен», не измерение. Системный промпт движка ' +
      'и описания инструментов сюда не входят — настоящий вес шага больше.',
    common: { tokens: commonTokens, files: common },
    byNode: byNode,
  };
}

/** Число шагов агента по кэш-чтению захода. Верхняя оценка — см. оговорку выше. */
function stepsFromCacheRead(cacheRead, perStep) {
  if (!cacheRead || !perStep) return null;
  return Number((cacheRead / perStep).toFixed(1));
}

function main() {
  const result = instructionWeight();
  if (!process.argv.includes('--human')) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  console.log('Вес инструктажа на один шаг вызова (оценка, не измерение)\n');
  console.log('Общая часть (всем узлам): ' + result.common.tokens + ' токенов');
  for (const f of result.common.files) console.log('  ' + f.file + ' — ' + f.tokens);
  console.log('');
  for (const [node, v] of Object.entries(result.byNode)) {
    console.log(
      node.padEnd(8) + String(v.perStep).padStart(7) + ' токенов на шаг' +
      '  (общее ' + v.common + ' + роль ' + v.role + ')'
    );
  }
  console.log('\n' + result.note);
}

if (require.main === module) main();

module.exports = { instructionWeight, stepsFromCacheRead, estimateTokens };
