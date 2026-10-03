// Граф движка: какой файл какие имена экспортирует и какой файл от какого зависит
// (require/import/source). Разбор регулярками, без модели — структура видна прямо
// в тексте файла, извлекать смысл не нужно.
//
//   node .claude/scripts/build-engine-graph.cjs
//
// Источники: .claude/scripts, .claude/hooks, board, dashboard, .forma/protocol/bin,
// .forma/protocol/scripts — файлы .cjs/.js/.py/.sh (без каталогов кэша вроде .forma/dashboard/.cache).
// Зеркала .codex/ и .agents/ не обходятся: ссылка на файл внутри них сворачивается
// в один узел-зеркало на каталог, а не в собственный узел файла.
//
// Выход: .forma/living/graphs/engine/graph.json (формат graphify: {nodes, edges}), кэш по
// хэшу содержимого каждого файла — .forma/living/graphs/engine/.cache.json. Неизменённый
// файл берёт свои узлы и рёбра из кэша; изменённый разбирается заново; удалённый
// уходит из графа вместе со своими узлами.

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { walk, readJson } = require('../../.forma/dashboard/lib/fs.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, '.forma/living', 'graphs', 'engine');
const GRAPH_FILE = path.join(OUT_DIR, 'graph.json');
const CACHE_FILE = path.join(OUT_DIR, '.cache.json');

const SCAN_DIRS = ['.claude/scripts', '.claude/hooks', '.forma/board', '.forma/dashboard', '.forma/protocol/bin', '.forma/protocol/scripts'];
const EXTS = ['.cjs', '.js', '.py', '.sh'];
const MIRROR_DIRS = { '.codex': 'mirror:codex', '.agents': 'mirror:agents' };

const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex');

// --- список файлов в области видимости -------------------------------------------

function sourceFiles() {
  const out = [];
  for (const d of SCAN_DIRS) {
    const abs = path.join(ROOT, d);
    const files = walk(abs, {
      abs: true, tolerant: true,
      skip: (entry) => entry.isDirectory() && (entry.name === '.cache' || entry.name === 'node_modules'),
    });
    for (const f of files) if (EXTS.includes(path.extname(f))) out.push(f);
  }
  return out;
}

// --- разбор одного файла: экспорты и ссылки на другие файлы ----------------------

function jsExports(text) {
  const names = new Set();
  for (const m of text.matchAll(/module\.exports\.(\w+)\s*=/g)) names.add(m[1]);
  for (const m of text.matchAll(/(?:^|[^.\w])exports\.(\w+)\s*=/g)) names.add(m[1]);
  const block = text.match(/module\.exports\s*=\s*\{([\s\S]*?)\n\}/);
  if (block) {
    for (const piece of block[1].split(',')) {
      const name = piece.trim().split(':')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  return [...names];
}

function jsRefs(text) {
  const refs = [];
  for (const m of text.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) refs.push(m[1]);
  for (const m of text.matchAll(/import\s+(?:[^'"]+?)\s+from\s+['"]([^'"]+)['"]/g)) refs.push(m[1]);
  for (const m of text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) refs.push(m[1]);
  return refs;
}

function pyExports(text) {
  const names = new Set();
  for (const m of text.matchAll(/^def\s+(\w+)\s*\(/gm)) names.add(m[1]);
  for (const m of text.matchAll(/^class\s+(\w+)\b/gm)) names.add(m[1]);
  return [...names];
}

function pyRefs(text) {
  const refs = [];
  for (const m of text.matchAll(/^from\s+(\.[\w.]*)\s+import/gm)) refs.push(m[1].replace(/\./g, '/'));
  return refs;
}

function shRefs(text) {
  const refs = [];
  for (const m of text.matchAll(/\bsource\s+["']?([^\s"';]+\.sh)/g)) refs.push(m[1]);
  for (const m of text.matchAll(/\bnode\s+["']?([^\s"';]+\.(?:cjs|js))/g)) refs.push(m[1]);
  for (const m of text.matchAll(/\bbash\s+["']?([^\s"';]+\.sh)/g)) refs.push(m[1]);
  return refs;
}

function parseFile(file, text) {
  const ext = path.extname(file);
  if (ext === '.cjs' || ext === '.js') return { exports: jsExports(text), refs: jsRefs(text) };
  if (ext === '.py') return { exports: pyExports(text), refs: pyRefs(text) };
  if (ext === '.sh') return { exports: [], refs: shRefs(text) };
  return { exports: [], refs: [] };
}

// --- разрешение ссылки в путь файла (или узел-зеркало, или «не наш» — пусто) -----

function resolveRef(fromFile, ref) {
  if (!ref.startsWith('.') && !ref.startsWith('/')) return null; // пакет/модуль, не файл репозитория
  const base = ref.startsWith('/') ? path.join(ROOT, ref) : path.resolve(path.dirname(fromFile), ref);
  const relPath = rel(base).replace(/\\/g, '/');
  for (const [dir, mirrorId] of Object.entries(MIRROR_DIRS)) {
    if (relPath === dir.slice(2) || relPath.startsWith(dir.slice(2) + '/')) return { mirror: mirrorId };
  }
  const candidates = [base, base + '.cjs', base + '.js', base + '.py', base + '.sh',
    path.join(base, 'index.cjs'), path.join(base, 'index.js')];
  for (const c of candidates) if (fs.existsSync(c) && fs.statSync(c).isFile()) return { file: 'file:' + rel(c) };
  return null;
}

// --- экстракция одного файла в {nodes, edges} -------------------------------------

function extract(file, text) {
  const id = 'file:' + rel(file);
  const nodes = [{ id, label: path.basename(file), type: 'file', source_file: rel(file) }];
  const edges = [];
  const mirrorsUsed = new Set();
  let parsed;
  try { parsed = parseFile(file, text); }
  catch (err) { return { nodes, edges, excluded: String(err && err.message || err) }; }

  for (const name of parsed.exports) {
    const expId = id + '#' + name;
    nodes.push({ id: expId, label: name, type: 'export', source_file: rel(file) });
    edges.push({ source: id, target: expId, relation: 'exports' });
  }
  const seen = new Set();
  for (const ref of parsed.refs) {
    const r = resolveRef(file, ref);
    if (!r) continue;
    if (r.mirror) {
      if (!mirrorsUsed.has(r.mirror)) mirrorsUsed.add(r.mirror);
      if (!seen.has(r.mirror)) { seen.add(r.mirror); edges.push({ source: id, target: r.mirror, relation: 'requires' }); }
      continue;
    }
    if (r.file === id || seen.has(r.file)) continue;
    seen.add(r.file);
    edges.push({ source: id, target: r.file, relation: 'requires' });
  }
  for (const m of mirrorsUsed) {
    const label = m === 'mirror:codex' ? 'Зеркало .codex' : 'Зеркало .agents';
    nodes.push({ id: m, label, type: 'mirror' });
  }
  return { nodes, edges, excluded: null };
}

// --- сборка с кэшем по хэшу содержимого --------------------------------------------

function build(cache) {
  const files = sourceFiles();
  const alive = new Set();
  const nodes = new Map(), edges = [];
  const excluded = [];
  let hit = 0, miss = 0;
  for (const file of files) {
    const key = rel(file);
    alive.add(key);
    const text = fs.readFileSync(file, 'utf8');
    const h = hash(text);
    let part = cache[key];
    if (part && part.hash === h) hit++;
    else { const r = extract(file, text); part = { hash: h, nodes: r.nodes, edges: r.edges, excluded: r.excluded }; cache[key] = part; miss++; }
    if (part.excluded) excluded.push({ file: key, reason: part.excluded });
    for (const n of part.nodes) nodes.set(n.id, { ...nodes.get(n.id), ...n });
    for (const e of part.edges) edges.push(e);
  }
  let gone = 0;
  for (const key of Object.keys(cache)) if (!alive.has(key)) { delete cache[key]; gone++; }
  return { nodes: [...nodes.values()], edges, hit, miss, gone, excluded, fileCount: files.length };
}

// --- отчёт: файлы без входящих рёбер, циклы зависимостей --------------------------

function reportEntryPoints(nodes, edges) {
  const fileIds = new Set(nodes.filter((n) => n.type === 'file').map((n) => n.id));
  const hasIncoming = new Set();
  for (const e of edges) if (e.relation === 'requires' && fileIds.has(e.target)) hasIncoming.add(e.target);
  return [...fileIds].filter((id) => !hasIncoming.has(id)).sort();
}

function reportCycles(nodes, edges) {
  const adj = new Map();
  for (const n of nodes) if (n.type === 'file') adj.set(n.id, []);
  for (const e of edges) if (e.relation === 'requires' && adj.has(e.source) && adj.has(e.target)) adj.get(e.source).push(e.target);

  const cycles = [];
  const state = new Map(); // 0 unvisited, 1 in stack, 2 done
  const stack = [];
  function dfs(u) {
    state.set(u, 1); stack.push(u);
    for (const v of adj.get(u) || []) {
      if (state.get(v) === 1) {
        const i = stack.indexOf(v);
        cycles.push(stack.slice(i).concat(v));
      } else if (!state.get(v)) dfs(v);
    }
    stack.pop(); state.set(u, 2);
  }
  for (const u of adj.keys()) if (!state.get(u)) dfs(u);
  return cycles;
}

// --- запуск -------------------------------------------------------------------------

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const cache = readJson(CACHE_FILE, {});
  const g = build(cache);

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  fs.writeFileSync(GRAPH_FILE, JSON.stringify({
    built: new Date().toISOString(), extractor: 'deterministic', model_tokens: 0,
    nodes: g.nodes, edges: g.edges,
  }, null, 1));

  console.log(`engine: ${g.nodes.length} узлов, ${g.edges.length} рёбер · файлов в области видимости ${g.fileCount} · ` +
    `из кэша ${g.hit}, разобрано ${g.miss}, ушло ${g.gone} · модель: 0 токенов`);

  if (g.excluded.length) {
    console.log('Исключены (ошибка разбора):');
    for (const e of g.excluded) console.log(`  ${e.file} — ${e.reason}`);
  } else {
    console.log('Исключённых файлов нет — все файлы области видимости охвачены.');
  }

  const entry = reportEntryPoints(g.nodes, g.edges);
  console.log(`Файлы без входящих рёбер «requires» (${entry.length}):`);
  for (const id of entry) console.log(`  ${id.slice('file:'.length)}`);

  const cycles = reportCycles(g.nodes, g.edges);
  if (cycles.length) {
    console.log(`Циклы зависимостей (${cycles.length}):`);
    for (const c of cycles) console.log('  ' + c.map((id) => id.slice('file:'.length)).join(' -> '));
  } else {
    console.log('Циклов зависимостей нет.');
  }
}

if (require.main === module) {
  try { main(); } catch (err) { console.error(String(err && err.message || err)); process.exit(2); }
}

module.exports = { sourceFiles, extract, resolveRef, reportEntryPoints, reportCycles, build };
