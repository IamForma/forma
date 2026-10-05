#!/usr/bin/env node
// Строит граф знаний по опыту закрытых карточек (.devtool/features/done/) —
// инкрементально, по хэшу файла (kit-задача «инкрементальный кэш графа, два канала»,
// не меняется файл → узлы/рёбра берутся из кэша, ни одного нового вызова
// модели; изменился/новый → cache-miss, извлекается заново по одному из двух каналов.
//
// Каналы извлечения (для cache-miss файлов):
//   internal (по умолчанию) — Node-скрипт САМ вызвать Agent tool не может (это может
//     только живая сессия) — печатает JSON-список cache-miss и останавливается, ждёт,
//     что живой агент (Intent/подобный) проведёт извлечение через Haiku и запишет
//     результат командой `record` (см. ниже).
//   external (--channel=external) — работает как раньше: сам вызывает
//     .claude/scripts/external-model-bridge.cjs (qwen3.7-flash / OpenRouter) на каждый
//     cache-miss файл, без остановки. Только по явной просьбе человека
//     (project/config/CONFIG.md#deepseek-extraction-quality — узкий контракт извлечения).
//
// Подкоманды:
//   node build-done-cards-graph.cjs --backfill
//     Разовая посадка кэша из уже готового .forma/living/graphs/done-cards/graph.json —
//     группирует существующие узлы/рёбра по source_file, считает хэш ТЕКУЩЕГО
//     содержимого каждого файла, пишет кэш как есть. Ни одного вызова модели.
//   node build-done-cards-graph.cjs [--channel=internal|external] [--trigger=...]
//     Обычный прогон: считает хэши, делит на cache-hit/cache-miss.
//     channel=internal, миссы есть → печатает список и останавливается (код 3).
//     channel=external → закрывает миссы сам через bridge, затем строит граф.
//     миссов нет (любой канал) → сразу собирает граф из кэша целиком.
//   node build-done-cards-graph.cjs record --file <relPath> --json <path> [--model M] [--channel internal|external] [--tokens N] [--cost N]
//     Записывает результат внешнего (по отношению к этому скрипту) извлечения одного
//     файла в кэш — по аналогии с .forma/dashboard/subagents-log.cjs record. --json указывает
//     на файл с {nodes,edges,hyperedges} — тем же форматом, что вернул бы bridge.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const os = require('os');
const { makeCli, parseOptions } = require('../../.forma/dashboard/lib/cli.cjs');
const { walk, readJson, writeJsonAtomic } = require('../../.forma/dashboard/lib/fs.cjs');
const { frontmatterBlock, withoutHistory } = require('../../.forma/dashboard/lib/card.cjs');

const cli = makeCli();

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
// --corpus done-cards|manual|project. Ключ кэша — путь от корня проекта,
// корни корпусов не пересекаются → ключи раздельны; done-cards — прежние ключи, прежний граф.
// .forma/manual/project: только *.md, рекурсивно (html/картинки макетов — не текст для извлечения).
const CORPORA = {
  'done-cards': { src: ['.devtool', 'features', 'done'], recursive: false, kind: 'card', label: 'Опыт' },
  manual: { src: ['.forma/manual'], recursive: true, kind: 'doc', label: 'Мануал' },
  project: { src: ['project'], recursive: true, kind: 'doc', label: 'Проект' },
};
const CORPUS = cli.eq('corpus', 'done-cards');
if (!CORPORA[CORPUS]) {
  console.error(`--corpus должен быть ${Object.keys(CORPORA).join('|')}, получено: ${CORPUS}`);
  process.exit(2);
}
const CORPUS_CFG = CORPORA[CORPUS];
const DONE_DIR = path.join(PROJECT_ROOT, ...CORPUS_CFG.src);
const OUT_DIR = path.join(PROJECT_ROOT, '.forma/living', 'graphs', CORPUS);
// GRAPH_BRIDGE — подмена моста для теста без вызова модели.
const BRIDGE = process.env.GRAPH_BRIDGE || path.join(PROJECT_ROOT, '.claude', 'scripts', 'external-model-bridge.cjs');
const LOG_FILE = path.join(PROJECT_ROOT, '.forma/dashboard', 'graphify.log');
const CONFIG_FILE = path.join(PROJECT_ROOT, '.forma/dashboard', 'graphify.config.json');
const BUDGET_STOP_FILE = path.join(PROJECT_ROOT, '.forma/dashboard', '.cache', 'graphify-budget-stop.json');
const CACHE_FILE = path.join(PROJECT_ROOT, '.forma/dashboard', '.cache', 'graphify-extract-cache.json');
const OLD_GRAPH_FILE = path.join(OUT_DIR, 'graph.json');

// --provider — openrouter|deepseek, по умолчанию openrouter (прежний путь).
// deepseek — прямой DeepSeek API через мост (как у build-engine-meaning.cjs),
// на случай когда OpenRouter недоступен из среды.
const EXTERNAL_PROVIDER = cli.eq('provider', 'openrouter');
const EXTERNAL_MODEL = 'deepseek/deepseek-v4-flash';

const TRIGGER = cli.eq('trigger', '.forma/manual');

function loadBudget() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const b = cfg.budget || {};
    return {
      maxUsdPerBuild: typeof b.maxUsdPerBuild === 'number' ? b.maxUsdPerBuild : null,
      alertUsd: typeof b.alertUsd === 'number' ? b.alertUsd : null,
    };
  } catch {
    return { maxUsdPerBuild: null, alertUsd: null };
  }
}

// хэш — без раздела «## История»/«## History» (до следующего ## или конца):
// строки расхода дописываются в закрытые карточки и не должны инвалидировать кэш.
function sha256(absPath) {
  const text = withoutHistory(fs.readFileSync(absPath, 'utf8'));
  return crypto.createHash('sha256').update(text).digest('hex');
}

// в граф опыта — только карточки, закрытые Core (frontmatter assignee: null).
function isClosedByCore(absPath) {
  const fm = frontmatterBlock(fs.readFileSync(absPath, 'utf8'));
  const m = fm && /^assignee:\s*(.*?)\s*$/m.exec(fm);
  return !!m && m[1] === 'null';
}

function readCache() {
  return readJson(CACHE_FILE, {});
}

function writeCacheAtomic(cache) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  writeJsonAtomic(CACHE_FILE, cache);
}

function listDoneFiles() {
  if (!fs.existsSync(DONE_DIR)) return [];
  if (!CORPUS_CFG.recursive) return fs.readdirSync(DONE_DIR).filter(f => f.endsWith('.md')).sort();
  return walk(DONE_DIR, { ext: '.md', symlinks: true, skip: (e) => e.name.startsWith('.') || e.name === 'node_modules' }).sort();
}

function relPathOf(f) {
  return path.join(...CORPUS_CFG.src, f).replace(/\\/g, '/');
}

// ---- канал external: извлечение одного файла через external-model-bridge.cjs ----

const EXTRACTION_SYSTEM = `You are a graphify extraction subagent. Read the file content given and extract a knowledge graph fragment.
Output ONLY valid JSON matching the schema below - no explanation, no markdown fences, no preamble.

Rules:
- EXTRACTED: relationship explicit in source (import, call, citation, "see section")
- INFERRED: reasonable inference (shared data structure, implied dependency)
- AMBIGUOUS: uncertain - flag for review, do not omit

${CORPUS_CFG.kind === 'card'
  ? 'This is a project-management card (a closed task record: Task/Kit/History/Result zones).'
  : 'This is a project document (protocol manual, brief, goal, config or reference file).'}
Extract named concepts, decisions, technical facts discovered, and entities (files, tools,
skills, plugins) mentioned. Also extract rationale - sections that explain WHY a decision
was made, trade-offs chosen, or a fact was recorded. These become nodes with rationale_for
edges pointing to the concept they explain.

confidence_score is REQUIRED on every edge - never omit it, never use 0.5 as a default:
- EXTRACTED edges: confidence_score = 1.0 always
- INFERRED edges: 0.6-0.9 depending on strength of evidence
- AMBIGUOUS edges: 0.1-0.3

Output exactly this JSON (no other text):
{"nodes":[{"id":"filestem_entityname","label":"Human Readable Name","file_type":"document","source_file":"relative/path","source_location":null,"source_url":null,"captured_at":null,"author":null,"contributor":null}],"edges":[{"source":"node_id","target":"node_id","relation":"implements|references|conceptually_related_to|rationale_for","confidence":"EXTRACTED|INFERRED|AMBIGUOUS","confidence_score":1.0,"source_file":"relative/path","source_location":null,"weight":1.0}],"hyperedges":[],"input_tokens":0,"output_tokens":0}`;

function stripFences(text) {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : t;
}

function extractOneExternal(relPath, absPath) {
  const content = fs.readFileSync(absPath, 'utf8');
  const prompt = `Source file: ${relPath}\n\n${content}`;
  const tmpPrompt = path.join(os.tmpdir(), `graphify-extract-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(tmpPrompt, prompt, 'utf8');
  const tmpOut = tmpPrompt + '.out.json';
  try {
    execFileSync('node', [
      BRIDGE,
      '--prompt-file', tmpPrompt,
      '--system', EXTRACTION_SYSTEM,
      '--provider', EXTERNAL_PROVIDER,
      '--model', EXTERNAL_MODEL,
      '--reasoning-effort', 'low',
      '--max-tokens', '16000',
      '--out', tmpOut,
      // Второй, независимый слой защиты поверх таймаута внутри external-model-bridge.cjs.
    ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 150000, windowsHide: true });
  } finally {
    fs.unlinkSync(tmpPrompt);
  }
  const report = JSON.parse(fs.readFileSync(tmpOut, 'utf8'));
  fs.unlinkSync(tmpOut);
  let parsed;
  try {
    parsed = JSON.parse(stripFences(report.text));
  } catch (err) {
    console.error(`  extraction JSON parse failed for ${relPath}: ${err.message}`);
    parsed = { nodes: [], edges: [], hyperedges: [] };
  }
  return { parsed, usage: report.usage, cost: report.cost_usd_estimate, durationMs: report.duration_ms };
}

// ---- backfill: посадка кэша из уже готового graph.json, без вызовов модели ----

function stripNodeExtras(n) {
  const rest = { ...n };
  delete rest.community; delete rest.norm_label;
  return rest;
}
function stripEdgeExtras(e) {
  const rest = { ...e };
  delete rest._src; delete rest._tgt;
  return rest;
}

function runBackfill() {
  if (!fs.existsSync(OLD_GRAPH_FILE)) {
    console.error(`Нет ${OLD_GRAPH_FILE} — backfill невозможен, кэш строить не из чего.`);
    process.exit(1);
  }
  const g = JSON.parse(fs.readFileSync(OLD_GRAPH_FILE, 'utf8'));
  const byFile = new Map();
  for (const n of g.nodes || []) {
    const f = n.source_file;
    if (!f) continue;
    if (!byFile.has(f)) byFile.set(f, { nodes: [], edges: [], hyperedges: [] });
    byFile.get(f).nodes.push(stripNodeExtras(n));
  }
  for (const e of g.links || []) {
    const f = e.source_file;
    if (!f) continue;
    if (!byFile.has(f)) byFile.set(f, { nodes: [], edges: [], hyperedges: [] });
    byFile.get(f).edges.push(stripEdgeExtras(e));
  }
  for (const he of g.hyperedges || []) {
    const f = he.source_file;
    if (!f) continue;
    if (!byFile.has(f)) byFile.set(f, { nodes: [], edges: [], hyperedges: [] });
    byFile.get(f).hyperedges.push(he);
  }

  // Дата извлечения — из существующей строки graphify.log (единственная запись
  // done-cards на момент backfill), а не «сегодня»: это не новое извлечение.
  let extractedAt = null;
  try {
    const log = fs.readFileSync(LOG_FILE, 'utf8');
    const m = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) \| .*corpus=done-cards/m.exec(log) || /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) \| mode=external-model-glm/m.exec(log);
    extractedAt = m ? m[1] : null;
  } catch { /* no-op */ }

  const cache = readCache();
  let seeded = 0;
  let missingOnDisk = 0;
  for (const [relFile, bucket] of byFile) {
    const absPath = path.join(PROJECT_ROOT, relFile);
    if (!fs.existsSync(absPath)) { missingOnDisk += 1; continue; }
    cache[relFile] = {
      hash: sha256(absPath),
      nodes: bucket.nodes,
      edges: bucket.edges,
      hyperedges: bucket.hyperedges,
      tokens: null,
      cost: null,
      extractedAt,
      model: EXTERNAL_MODEL,
      channel: 'external',
      backfill: true,
    };
    seeded += 1;
  }
  writeCacheAtomic(cache);
  console.log(`Backfill: ${seeded} файлов посажено в кэш из ${OLD_GRAPH_FILE} (${missingOnDisk} упомянутых source_file не найдено на диске — пропущены), ноль вызовов модели.`);
}

// ---- запись результата внешнего по отношению к скрипту извлечения (record) ----

function runRecord(argv) {
  const args = parseOptions(argv, { greedy: true });
  if (!args.file || !args.json) {
    console.error('usage: node build-done-cards-graph.cjs record --file <relPath> --json <path-to-{nodes,edges,hyperedges}.json> [--model M] [--channel internal|external] [--tokens N] [--cost N]');
    process.exit(2);
  }
  const relFile = args.file.replace(/\\/g, '/');
  const absPath = path.join(PROJECT_ROOT, relFile);
  if (!fs.existsSync(absPath)) {
    console.error(`Файл не найден: ${absPath}`);
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(args.json, 'utf8'));
  const cache = readCache();
  cache[relFile] = {
    hash: sha256(absPath),
    nodes: payload.nodes || [],
    edges: payload.edges || [],
    hyperedges: payload.hyperedges || [],
    tokens: args.tokens !== undefined ? Number(args.tokens) : null,
    cost: args.cost !== undefined ? Number(args.cost) : null,
    extractedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    model: args.model || 'claude-haiku',
    channel: args.channel || 'internal',
  };
  writeCacheAtomic(cache);
  console.log(`Записано в кэш: ${relFile} (${(payload.nodes || []).length} узлов, ${(payload.edges || []).length} рёбер, channel=${cache[relFile].channel}).`);
}

// ---- основной прогон: cache-hit/cache-miss, канал, сборка ----

// Файлы корпуса; для done-cards — только закрытые Core. Пусто — выход 0.
function selectFiles() {
  let files = listDoneFiles();
  if (CORPUS === 'done-cards') {
    const all = files.length;
    files = files.filter(f => isClosedByCore(path.join(DONE_DIR, f)));
    console.log(`Корпус done-cards: закрыто Core (assignee: null) — ${files.length}, пропущено не закрытых (assignee ≠ null, напр. "Core") — ${all - files.length}.`);
  }
  if (files.length === 0) {
    console.error(`В ${DONE_DIR} нет карточек — графу строить не из чего.`);
    process.exit(0);
  }
  return files;
}

// cache-hit: хэш совпал с записью кэша; иначе cache-miss.
function splitByCache(files, cache) {
  const hits = [];
  const misses = [];
  for (const f of files) {
    const relPath = relPathOf(f);
    const absPath = path.join(DONE_DIR, f);
    const hash = sha256(absPath);
    const cached = cache[relPath];
    if (cached && cached.hash === hash) {
      hits.push(relPath);
    } else {
      misses.push({ relPath, absPath, hash });
    }
  }
  return { hits, misses };
}

// --dry-run — список cache-miss и оценка объёма (символы/4), без вызова модели.
function printDryRun(misses) {
  let chars = 0;
  for (const m of misses) {
    const c = fs.readFileSync(m.absPath, 'utf8').length;
    chars += c;
    console.log(`  ${m.relPath}\t~${Math.round(c / 4)} tok`);
  }
  console.log(`Сухой прогон: ${misses.length} cache-miss, ~${chars} символов ≈ ~${Math.round(chars / 4)} токенов входа (оценка символы/4). Модель не вызывалась.`);
  process.exit(0);
}

function stopForInternalExtraction(misses) {
  console.log(JSON.stringify(misses.map(m => ({ relPath: m.relPath, absPath: m.absPath })), null, 2));
  console.error(`\nЖду внешнего извлечения (канал internal): ${misses.length} файл(ов) без Agent tool не обработать — этот скрипт сам его вызвать не может. Извлеки через Haiku и запиши каждый результат:\n  node .claude/scripts/build-done-cards-graph.cjs record --file <relPath> --json <path> --model <модель>\nПотом перезапусти этот скрипт — соберёт граф из полного кэша.`);
  process.exit(3);
}

// Один cache-miss через мост. Запись — сразу после ответа модели, поверх свежего чтения кэша
// (не затирает записи, сделанные с начала прогона), атомарно: tmp + rename.
function extractAndStore(m, cache) {
  const { parsed, usage, cost } = extractOneExternal(m.relPath, m.absPath);
  const fresh = readCache();
  fresh[m.relPath] = cache[m.relPath] = {
    hash: m.hash,
    nodes: parsed.nodes || [],
    edges: parsed.edges || [],
    hyperedges: parsed.hyperedges || [],
    tokens: usage?.total_tokens || 0,
    cost: cost || 0,
    extractedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    model: EXTERNAL_MODEL,
    channel: 'external',
  };
  writeCacheAtomic(fresh); // сохраняем прогресс сразу — не теряем при обрыве
  return { parsed, tokens: usage?.total_tokens || 0, cost: cost || 0 };
}

// Бюджет после очередного файла: предупреждение один раз, остановка — true.
function budgetStops(budget, stats) {
  if (budget.alertUsd != null && !stats.alertLogged && stats.totalCost >= budget.alertUsd) {
    stats.alertLogged = true;
    console.warn(`⚠ Бюджет: потрачено $${stats.totalCost.toFixed(6)} >= alertUsd $${budget.alertUsd} — продолжаю.`);
  }
  if (budget.maxUsdPerBuild != null && stats.totalCost >= budget.maxUsdPerBuild) {
    console.error(`⛔ Бюджет исчерпан: $${stats.totalCost.toFixed(6)} >= maxUsdPerBuild $${budget.maxUsdPerBuild} — остановлено, граф строится по уже накопленному кэшу.`);
    return true;
  }
  return false;
}

const emptyStats = () => ({ extracted: 0, totalTokens: 0, totalCost: 0, failed: 0, budgetStopped: false, alertLogged: false });

// Канал external: каждый cache-miss — через мост, до бюджета; слишком много сбоев — выход 1.
function runExternalChannel(misses, cache, budget) {
  const stats = emptyStats();
  for (let i = 0; i < misses.length; i++) {
    const m = misses[i];
    process.stdout.write(`[${i + 1}/${misses.length}] ${m.relPath} ... `);
    try {
      const { parsed, tokens, cost } = extractAndStore(m, cache);
      stats.totalTokens += tokens;
      stats.totalCost += cost;
      stats.extracted += 1;
      console.log(`${(parsed.nodes || []).length} узлов, ${(parsed.edges || []).length} рёбер`);
    } catch (err) {
      stats.failed += 1;
      console.log(`ОШИБКА: ${err.message}`);
    }
    if (budgetStops(budget, stats)) { stats.budgetStopped = true; break; }
  }
  if (!stats.budgetStopped && stats.failed > misses.length / 2) {
    console.error(`Слишком много сбоев (${stats.failed}/${misses.length}) — остановлено, граф не собран.`);
    process.exit(1);
  }
  return stats;
}

// Слияние: перечитываем кэш (мог обновиться в цикле выше) и собираем всё, что покрыто.
function mergeCached(files) {
  const finalCache = readCache();
  const merged = { nodes: [], edges: [], hyperedges: [], covered: 0 };
  for (const f of files) {
    const entry = finalCache[relPathOf(f)];
    if (!entry) continue; // всё ещё cache-miss (бюджет остановил внешний канал раньше)
    merged.covered += 1;
    merged.nodes.push(...(entry.nodes || []));
    merged.edges.push(...(entry.edges || []));
    merged.hyperedges.push(...(entry.hyperedges || []));
  }
  return merged;
}

// Санитайз данных модели (в основном GLM, канал external) перед сериализацией
// для Python-шага: graphify падает на пустых source/target и на file_type вне
// своего enum. Отбрасываем/чиним здесь, с честным логом, не в Python.
const VALID_FILE_TYPES = new Set(['code', 'concept', 'document', 'image', 'paper', 'rationale']);

function sanitizeExtraction(allNodes, allEdges) {
  let fixedFileTypes = 0;
  for (const n of allNodes) {
    if (!VALID_FILE_TYPES.has(n.file_type)) {
      n.file_type = 'document';
      fixedFileTypes += 1;
    }
  }
  const validEdges = allEdges.filter((e) => e && e.source && e.target);
  const droppedEdges = allEdges.length - validEdges.length;
  if (droppedEdges > 0 || fixedFileTypes > 0) {
    console.log(`Санитайз: отброшено рёбер с пустым source/target = ${droppedEdges}, поправлено file_type вне enum = ${fixedFileTypes}.`);
  }
  const seen = new Map();
  for (const n of allNodes) seen.set(n.id, n);
  return { nodes: [...seen.values()], edges: validEdges };
}

// Python-шаг: build_from_json → кластеры → отчёт, graph.json, graph.html.
function graphPythonScript(totalTokens) {
  return `
import json
from pathlib import Path
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json, to_html
from graphify.detect import detect

out_dir = Path(r"${OUT_DIR.replace(/\\/g, '\\\\')}")
extraction = json.loads((out_dir / ".graphify_extract.json").read_text(encoding="utf-8"))
detection = detect(Path(r"${DONE_DIR.replace(/\\/g, '\\\\')}"))

G = build_from_json(extraction)
if G.number_of_nodes() == 0:
    print("ERROR: Graph is empty")
    raise SystemExit(1)

communities = cluster(G)
cohesion = score_all(G, communities)
gods = god_nodes(G)
surprises = surprising_connections(G, communities)
labels = {cid: f"${CORPUS_CFG.label}: кластер {cid}" for cid in communities}
questions = suggest_questions(G, communities, labels)
tokens = {"input": 0, "output": ${totalTokens}}

report = generate(G, communities, cohesion, labels, gods, surprises, detection, tokens, "${DONE_DIR.replace(/\\/g, '/')}", suggested_questions=questions)
(out_dir / "GRAPH_REPORT.md").write_text(report, encoding="utf-8")
to_json(G, communities, str(out_dir / "graph.json"))
if G.number_of_nodes() <= 5000:
    to_html(G, communities, str(out_dir / "graph.html"), community_labels=labels)
print(f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(communities)} communities")
`;
}

// Запускает Python-шаг; сбой — выход 1. Возвращает его stdout.
function buildGraphPython(totalTokens) {
  const tmpPy = path.join(os.tmpdir(), `graphify-build-${Date.now()}.py`);
  fs.writeFileSync(tmpPy, graphPythonScript(totalTokens), 'utf8');
  try {
    return execFileSync('python', [tmpPy], { encoding: 'utf8' });
  } catch (err) {
    console.error('Python build failed:', err.stdout || err.message);
    process.exit(1);
  } finally {
    fs.unlinkSync(tmpPy);
  }
}

// Строка в graphify.log; возвращает метку времени, общую с файлом остановки по бюджету.
function appendBuildLog(r) {
  const { channel, files, hits, stats, merged, pyOut } = r;
  const statsMatch = /Graph:\s*(\d+)\s*nodes,\s*(\d+)\s*edges,\s*(\d+)\s*communities/.exec(pyOut);
  const nodesCount = statsMatch ? statsMatch[1] : r.nodesCount;
  const edgesCount = statsMatch ? statsMatch[2] : merged.edges.length;
  const communitiesCount = statsMatch ? statsMatch[3] : 0;
  const warningsCount = stats.failed + (stats.budgetStopped ? 1 : 0) + (files.length - merged.covered);

  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const modeTag = channel === 'external' ? 'external-model-glm' : 'internal-cache';
  const summaryNote = merged.covered < files.length
    ? `Построен граф ${CORPUS} из кэша (покрыто ${merged.covered}/${files.length}, cache_hits=${hits.length}, extracted=${stats.extracted})`
    : `Построен граф ${CORPUS} из кэша (${files.length} файлов, cache_hits=${hits.length}, extracted=${stats.extracted})`;
  const logLine = `${ts} | mode=${modeTag} | agents=0 | tokens=${stats.totalTokens} | $${stats.totalCost.toFixed(6)} | corpus=${CORPUS} | trigger=${TRIGGER} | nodes=${nodesCount} | edges=${edgesCount} | communities=${communitiesCount} | warnings=${warningsCount} | cache_hits=${hits.length} | extracted=${stats.extracted} | ${summaryNote}\n`;
  fs.appendFileSync(LOG_FILE, logLine, 'utf8');
  return ts;
}

// Файл остановки по бюджету: есть, пока последний прогон упёрся в maxUsdPerBuild.
function syncBudgetStop(ts, r) {
  const { stats, budget, files, merged } = r;
  fs.mkdirSync(path.dirname(BUDGET_STOP_FILE), { recursive: true });
  if (stats.budgetStopped) {
    fs.writeFileSync(BUDGET_STOP_FILE, JSON.stringify({
      corpus: CORPUS, at: ts, costUsd: Number(stats.totalCost.toFixed(6)), maxUsdPerBuild: budget.maxUsdPerBuild,
      filesProcessed: merged.covered, filesTotal: files.length,
    }, null, 2), 'utf8');
  } else if (fs.existsSync(BUDGET_STOP_FILE)) {
    fs.unlinkSync(BUDGET_STOP_FILE);
  }
}

function runMain(channel) {
  const files = selectFiles();
  const cache = readCache();
  const { hits, misses } = splitByCache(files, cache);

  console.log(`Корпус ${CORPUS}: ${files.length} файлов. cache-hit=${hits.length}, cache-miss=${misses.length}.`);

  if (cli.flag('dry-run')) printDryRun(misses);
  // --limit=N — закрыть внешним каналом не больше N миссов (пробный прогон).
  const limitArg = cli.eq('limit');
  if (limitArg !== undefined) misses.splice(Number(limitArg) || 0);
  if (misses.length > 0 && channel === 'internal') stopForInternalExtraction(misses);

  const budget = loadBudget();
  const stats = misses.length > 0 && channel === 'external' ? runExternalChannel(misses, cache, budget) : emptyStats();
  const merged = mergeCached(files);
  const { nodes, edges } = sanitizeExtraction(merged.nodes, merged.edges);

  const extraction = { nodes, edges, hyperedges: merged.hyperedges, input_tokens: 0, output_tokens: 0 };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const extractPath = path.join(OUT_DIR, '.graphify_extract.json');
  fs.writeFileSync(extractPath, JSON.stringify(extraction), 'utf8');

  console.log(`\nПокрыто кэшем: ${merged.covered}/${files.length} файлов. Слияние: ${nodes.length} узлов, ${merged.edges.length} рёбер, ${merged.hyperedges.length} гиперрёбер (cache_hits=${hits.length}, extracted=${stats.extracted}).`);
  console.log('Строю граф (Python)...');
  const pyOut = buildGraphPython(stats.totalTokens);
  console.log(pyOut.trim());
  fs.unlinkSync(extractPath);

  const summary = { channel, files, hits, stats, budget, merged, pyOut, nodesCount: nodes.length };
  const ts = appendBuildLog(summary);
  const pendingFile = path.join(PROJECT_ROOT, '.forma/dashboard', '.cache', 'graphify-pending.json');
  if (fs.existsSync(pendingFile)) fs.unlinkSync(pendingFile);
  syncBudgetStop(ts, summary);

  console.log(`\nГотово. Записано в ${LOG_FILE}, вкладка «Граф: Опыт» на дашборде.`);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === 'record') { runRecord(argv.slice(1)); return; }
  if (argv.includes('--backfill')) { runBackfill(); return; }
  const channelArg = cli.eq('channel');
  // флаг сильнее конфига; без флага — executor.channel из graphify.config.json
  let cfgChannel = 'internal';
  try { cfgChannel = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')).executor.channel || 'internal'; } catch { /* нет конфига или поля канала — внутренний канал по умолчанию */ }
  const channel = channelArg !== undefined ? channelArg : cfgChannel;
  if (channel !== 'internal' && channel !== 'external') {
    console.error(`--channel должен быть internal|external, получено: ${channel}`);
    process.exit(2);
  }
  runMain(channel);
}

main();
