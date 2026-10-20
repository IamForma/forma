#!/usr/bin/env node
// Вопросы к графам Kit без модели: узел, соседи, путь, поиск, дайджест обрывов.
//   node .claude/scripts/graph-query.cjs find <текст> [--graph central] [--type card|goal|role|file|...]
//   node .claude/scripts/graph-query.cjs node <id|метка> [--graph central]   — узел и его рёбра по отношениям
//   node .claude/scripts/graph-query.cjs path <откуда> <куда> [--graph central]  — кратчайший путь (рёбра без направления)
//   node .claude/scripts/graph-query.cjs digest                              — обрывы из отчёта central, несколько строк
// Графы: .forma/living/graphs/<имя>/graph.json (central объединяет остальные). Нет графа — строка «нет графа», код 1.
// id узла в central: card:card-NNN, goal:goal-X, epic:<имя>, role:<имя>, file:<путь>, zone:<путь>, asset:<sha12>.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const GRAPHS = path.join(ROOT, '.forma', 'living', 'graphs');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const pos = [];
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) i++; else pos.push(argv[i]); }
const [cmd, ...rest] = pos;

function load(name) {
  const f = path.join(GRAPHS, name, 'graph.json');
  if (!fs.existsSync(f)) { console.error(`нет графа ${name}: node .claude/scripts/build-kit-graphs.cjs`); process.exit(1); }
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

const short = n => `${n.id}${n.label && n.label !== n.id ? ' — ' + String(n.label).slice(0, 80) : ''}${n.type ? ' [' + n.type + ']' : ''}`;

function resolve(g, q) {
  const by = new Map(g.nodes.map(n => [n.id, n]));
  if (by.has(q)) return [by.get(q)];
  const low = q.toLowerCase();
  const exactSuffix = g.nodes.filter(n => n.id.toLowerCase().endsWith(':' + low) || String(n.label || '').toLowerCase() === low);
  if (exactSuffix.length) return exactSuffix;
  return g.nodes.filter(n => n.id.toLowerCase().includes(low) || String(n.label || '').toLowerCase().includes(low));
}

function one(g, q) {
  const hits = resolve(g, q);
  if (!hits.length) { console.log(`не найдено: ${q}`); process.exit(1); }
  if (hits.length > 1) {
    console.log(`несколько совпадений (${hits.length}), уточните id:`);
    hits.slice(0, 15).forEach(n => console.log('  ' + short(n)));
    process.exit(1);
  }
  return hits[0];
}

function cmdFind() {
  const g = load(flag('graph', 'central')), type = flag('type', '');
  const q = rest.join(' ').toLowerCase();
  if (!q) { console.error('find <текст>'); process.exit(2); }
  const hits = g.nodes.filter(n => (!type || n.type === type) && (n.id.toLowerCase().includes(q) || String(n.label || '').toLowerCase().includes(q)));
  console.log(`${hits.length} узлов`);
  hits.slice(0, 30).forEach(n => console.log('  ' + short(n)));
  if (hits.length > 30) console.log(`  … ещё ${hits.length - 30}, сузьте запрос или --type`);
}

function cmdNode() {
  const g = load(flag('graph', 'central')), n = one(g, rest.join(' '));
  console.log(short(n) + (n.file ? ` · ${n.file}` : n.source_file ? ` · ${n.source_file}` : ''));
  const by = new Map(g.nodes.map(x => [x.id, x]));
  const groups = new Map();
  for (const e of g.edges) {
    if (e.source !== n.id && e.target !== n.id) continue;
    const out = e.source === n.id, other = by.get(out ? e.target : e.source);
    if (!other) continue;
    const k = (out ? '→ ' : '← ') + e.relation;
    (groups.get(k) || groups.set(k, []).get(k)).push(other);
  }
  if (!groups.size) console.log('  рёбер нет (оборванный узел)');
  for (const [k, list] of groups) {
    console.log(`  ${k} (${list.length}):`);
    list.slice(0, 8).forEach(o => console.log('      ' + short(o)));
    if (list.length > 8) console.log(`      … ещё ${list.length - 8}`);
  }
}

function cmdPath() {
  const g = load(flag('graph', 'central'));
  if (rest.length < 2) { console.error('path <откуда> <куда>'); process.exit(2); }
  const a = one(g, rest[0]), b = one(g, rest[1]);
  const adj = new Map();
  for (const e of g.edges) {
    (adj.get(e.source) || adj.set(e.source, []).get(e.source)).push([e.target, e.relation + ' →']);
    (adj.get(e.target) || adj.set(e.target, []).get(e.target)).push([e.source, '← ' + e.relation]);
  }
  const prev = new Map([[a.id, null]]), queue = [a.id];
  while (queue.length && !prev.has(b.id)) {
    const cur = queue.shift();
    for (const [nx, rel] of adj.get(cur) || []) if (!prev.has(nx)) { prev.set(nx, [cur, rel]); queue.push(nx); }
  }
  if (!prev.has(b.id)) { console.log(`пути между ${a.id} и ${b.id} нет`); process.exit(1); }
  const steps = [];
  for (let c = b.id; prev.get(c); c = prev.get(c)[0]) steps.unshift([c, prev.get(c)[1]]);
  const by = new Map(g.nodes.map(x => [x.id, x]));
  console.log(short(a));
  steps.forEach(([id, rel]) => console.log(`  ${rel} ${short(by.get(id))}`));
}

const list = (l, n = 4) => l.length ? `${l.length} (${l.slice(0, n).join(', ')}${l.length > n ? ', …' : ''})` : '0';

function cmdDigest() {
  const f = path.join(GRAPHS, 'central', 'graph.json');
  if (!fs.existsSync(f)) { console.log('Графов нет — node .claude/scripts/build-kit-graphs.cjs.'); return; }
  const g = JSON.parse(fs.readFileSync(f, 'utf8')), r = g.report;
  if (!r) { console.log('В central нет отчёта — пересоберите графы.'); return; }
  const lines = [];
  const add = (label, l) => { if (l.length) lines.push(`- ${label}: ${list(l)}`); };
  add('карточки без цели', r.cards_without_goal);
  add('карточки без роли', r.cards_without_role);
  add('роли без карточек', r.roles_without_cards);
  add('цели без карточек', r.goals_without_cards);
  if (r.dropped_edges) lines.push(`- рёбра на несуществующий узел: ${r.dropped_edges}` + (r.dropped_sample && r.dropped_sample.length ? ` (${r.dropped_sample.slice(0, 3).join(', ')})` : ''));
  if (r.structure) {
    const s = r.structure;
    if (s.cards_with_missing_path) lines.push(`- карточки с путём, которого нет: ${s.cards_with_missing_path}`);
    if (s.zones_without_readme) lines.push(`- зоны без README: ${s.zones_without_readme}`);
    if (s.goals_without_zone) lines.push(`- цели без зоны: ${s.goals_without_zone}`);
  }
  if (r.resources) {
    const x = r.resources;
    if (x.without_description) lines.push(`- ресурсы без описания: ${x.without_description}`);
    if (x.without_file) lines.push(`- записи реестра без файла: ${x.without_file}`);
    if (x.without_entry) lines.push(`- файлы без записи в реестре: ${x.without_entry}`);
  }
  console.log(`Обрывы по графам (${new Date(g.built).toISOString().slice(0, 16).replace('T', ' ')}; вопрос к графу — node .claude/scripts/graph-query.cjs find|node|path):`);
  console.log(lines.length ? lines.join('\n') : '- обрывов нет');
}

({ find: cmdFind, node: cmdNode, path: cmdPath, digest: cmdDigest }[cmd] || (() => {
  console.error('graph-query: find <текст> | node <id> | path <a> <b> | digest  [--graph central]');
  process.exit(2);
}))();
