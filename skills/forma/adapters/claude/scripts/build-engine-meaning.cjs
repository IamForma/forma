#!/usr/bin/env node
// Слой смысла поверх скелета графа движка (build-engine-graph.cjs): для каждого
// узла-файла — одна строка «за что отвечает» (description) и список возможностей
// (capabilities), плюс группа-модуль (group). Группа — детерминированная, по пути,
// без модели: обходится кэшем и остаётся бесплатной при каждом перезапуске.
// Описание и возможности — только для cache-miss (хэш содержимого файла
// изменился), через external-model-bridge.cjs: назначение файла видно по смыслу
// кода, не по regex (это и отличает слой смысла от скелета).
//
//   node .claude/scripts/build-engine-meaning.cjs [--dry-run] [--limit=N]
//
// Вход: .forma/living/graphs/engine/graph.json — должен существовать (сначала
// build-engine-graph.cjs). Выход: тот же файл — у каждого узла type:"file"
// проставлены description, capabilities, group; остальные узлы и рёбра не трогаются.
// Кэш — .forma/living/graphs/engine/.meaning-cache.json, по sha1 содержимого файла.
//
// --dry-run — список cache-miss без вызова модели. --limit=N — не больше N
// промахов за прогон (пробный запуск).

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execFileSync } = require('child_process');
const { makeCli } = require('../../.forma/dashboard/lib/cli.cjs');
const { readJson, writeJsonAtomic } = require('../../.forma/dashboard/lib/fs.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, '.forma/living', 'graphs', 'engine');
const GRAPH_FILE = path.join(OUT_DIR, 'graph.json');
const CACHE_FILE = path.join(OUT_DIR, '.meaning-cache.json');
// GRAPH_BRIDGE — подмена моста для теста без вызова модели.
const BRIDGE = process.env.GRAPH_BRIDGE || path.join(ROOT, '.claude', 'scripts', 'external-model-bridge.cjs');

// Канал — прямой DeepSeek API (не OpenRouter). Та же базовая модель
// (deepseek-flash); мост сам подставит легаси-имя deepseek-chat для --provider deepseek.
const PROVIDER = 'deepseek';
const MODEL = 'deepseek/deepseek-v4-flash';
const MAX_SOURCE_CHARS = 8000; // хватает на суть файла, не разгоняет стоимость крупных

const cli = makeCli();
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex');

// --- группа-модуль: детерминированно по пути, порядок правил важен ---------------
const GROUP_RULES = [
  [/^\.claude\/hooks\//, 'hooks'],
  [/^board\//, '.forma/board'],
  [/^protocol\//, 'sync-engines'],
  [/^\.claude\/scripts\/sync-engines\.cjs$/, 'sync-engines'],
  [/^\.claude\/scripts\/checks\//, 'sync-engines'],
  [/^dashboard\/checks\//, 'sync-engines'],
  [/adapter/i, 'adapters'],
  [/econom|spend|tool-usage|cycle-status/i, 'economy'],
  [/^\.claude\/scripts\/build-.*graphs?\.cjs$|^\.claude\/scripts\/build-tendons\.cjs$/, 'graphs'],
  [/^dashboard\//, '.forma/dashboard'],
  [/\.py$/, 'translate'],
];
function groupOf(relPath) {
  for (const [re, g] of GROUP_RULES) if (re.test(relPath)) return g;
  return 'scripts';
}

// --- извлечение одного файла через мост -------------------------------------------
const EXTRACTION_SYSTEM = `Ты — ассистент картографии кода. Дан текст одного файла движка.
Ответь ТОЛЬКО валидным JSON, без markdown-ограждений, без пояснений:
{"description":"одна фраза по-русски — за что отвечает этот файл","capabilities":["короткая фраза","..."]}
capabilities — 2-6 коротких пунктов по-русски о конкретных возможностях файла (что он делает/отдаёт), без синтаксиса кода.`;

function stripFences(text) {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : t;
}

function extractOne(relPath, text) {
  const truncated = text.length > MAX_SOURCE_CHARS ? text.slice(0, MAX_SOURCE_CHARS) + '\n... (обрезано)' : text;
  const prompt = `Файл: ${relPath}\n\n${truncated}`;
  const tmpPrompt = path.join(os.tmpdir(), `engine-meaning-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(tmpPrompt, prompt, 'utf8');
  const tmpOut = tmpPrompt + '.out.json';
  try {
    execFileSync('node', [
      BRIDGE,
      '--prompt-file', tmpPrompt,
      '--system', EXTRACTION_SYSTEM,
      '--provider', PROVIDER,
      '--model', MODEL,
      '--reasoning-effort', 'low',
      '--max-tokens', '1200',
      '--out', tmpOut,
    ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120000, windowsHide: true });
  } finally {
    fs.unlinkSync(tmpPrompt);
  }
  const report = JSON.parse(fs.readFileSync(tmpOut, 'utf8'));
  fs.unlinkSync(tmpOut);
  let parsed;
  try { parsed = JSON.parse(stripFences(report.text)); }
  catch (err) { console.error(`  extraction JSON parse failed for ${relPath}: ${err.message}`); parsed = { description: '', capabilities: [] }; }
  return { parsed, usage: report.usage, cost: report.cost_usd_estimate };
}

// --- запуск -------------------------------------------------------------------------

function loadGraph() {
  if (!fs.existsSync(GRAPH_FILE)) {
    console.error(`Нет ${GRAPH_FILE} — сначала node .claude/scripts/build-engine-graph.cjs`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(GRAPH_FILE, 'utf8'));
}

function splitByCache(fileNodes, cache) {
  const hits = [], misses = [];
  for (const n of fileNodes) {
    const abs = path.join(ROOT, n.source_file);
    if (!fs.existsSync(abs)) continue; // файл ушёл из скелета — отдельный прогон build-engine-graph.cjs разберётся
    const text = fs.readFileSync(abs, 'utf8');
    const h = hash(text);
    const cached = cache[n.source_file];
    if (cached && cached.hash === h) hits.push(n.source_file);
    else misses.push({ relPath: n.source_file, text, hash: h });
  }
  return { hits, misses };
}

function printGroupCoverage(fileNodes) {
  const byGroup = new Map();
  for (const n of fileNodes) {
    const g = groupOf(n.source_file);
    byGroup.set(g, (byGroup.get(g) || 0) + 1);
  }
  const total = [...byGroup.values()].reduce((a, b) => a + b, 0);
  console.log(`Группы (${byGroup.size}), покрыто файлов: ${total}/${fileNodes.length}:`);
  for (const [g, n] of [...byGroup.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${g}: ${n}`);
}

function main() {
  const g = loadGraph();
  const fileNodes = g.nodes.filter((n) => n.type === 'file');
  const cache = readJson(CACHE_FILE, {});
  const { hits, misses } = splitByCache(fileNodes, cache);

  console.log(`Узлов-файлов: ${fileNodes.length}. cache-hit=${hits.length}, cache-miss=${misses.length}.`);

  if (cli.flag('dry-run')) {
    for (const m of misses) console.log(`  ${m.relPath}`);
    printGroupCoverage(fileNodes);
    process.exit(0);
  }

  const limitArg = cli.eq('limit');
  const todo = limitArg !== undefined ? misses.slice(0, Number(limitArg) || 0) : misses;

  let totalTokens = 0, totalCost = 0, failed = 0;
  for (let i = 0; i < todo.length; i++) {
    const m = todo[i];
    process.stdout.write(`[${i + 1}/${todo.length}] ${m.relPath} ... `);
    try {
      const { parsed, usage, cost } = extractOne(m.relPath, m.text);
      cache[m.relPath] = {
        hash: m.hash,
        description: parsed.description || '',
        capabilities: parsed.capabilities || [],
        tokens: usage?.total_tokens || 0,
        cost: cost || 0,
        extractedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        model: MODEL,
      };
      writeJsonAtomic(CACHE_FILE, cache); // сохраняем сразу — не теряем прогресс при обрыве
      totalTokens += usage?.total_tokens || 0;
      totalCost += cost || 0;
      console.log(`ok (${usage?.total_tokens || 0} tok)`);
    } catch (err) {
      failed++;
      console.log(`ОШИБКА: ${err.message}`);
    }
  }

  // слияние: группа — всегда (детерминированно), описание/возможности — из кэша, если есть
  let withMeaning = 0;
  for (const n of g.nodes) {
    if (n.type !== 'file') continue;
    n.group = groupOf(n.source_file);
    const c = cache[n.source_file];
    if (c) { n.description = c.description; n.capabilities = c.capabilities; withMeaning++; }
  }
  g.meaning_built = new Date().toISOString();
  g.meaning_model = MODEL;
  fs.writeFileSync(GRAPH_FILE, JSON.stringify(g, null, 1));

  printGroupCoverage(fileNodes);
  console.log(`\nС описанием: ${withMeaning}/${fileNodes.length}. Потрачено за прогон: ${totalTokens} токенов, $${totalCost.toFixed(6)}. Ошибок: ${failed}.`);
  console.log(`Записано: ${GRAPH_FILE}, кэш: ${CACHE_FILE}.`);
}

if (require.main === module) {
  try { main(); } catch (err) { console.error(String(err && err.message || err)); process.exit(2); }
}

module.exports = { groupOf, splitByCache, extractOne };
