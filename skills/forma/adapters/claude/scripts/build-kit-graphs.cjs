// Три бесплатных графа Kit: цели, живая доска, арсенал.
//
// Всё, из чего они строятся, уже записано явно — frontmatter карточек, метки
// целей, карта ROADMAP.md, фронтматтер ролей, журнал инструментов. Поэтому модель
// здесь не вызывается ни разу: разбор текста, а не извлечение смысла. Смысловые
// графы (опыт, manual, project) строятся другими скриптами, и модель для них
// выбирает Kit — самую маленькую, какая справится.
//
// Инкрементально по хэшу файла: неизменённый файл берёт свои узлы и рёбра из
// кэша, изменённый разбирается заново, удалённый уходит из графа вместе со своими
// узлами. Граф не пересобирается — он дописывается тем, что поменялось.
//
//   node .claude/scripts/build-kit-graphs.cjs [--only goals|board|arsenal]
//
// Выход: .forma/living/graphs/{goals,board,arsenal}/graph.json — формат graphify
// ({nodes:[{id,label,type,source_file}], edges:[{source,target,relation}]}),
// кэш: .forma/living/graphs/.kit-cache.json.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readJson } = require('../../.forma/dashboard/lib/fs.cjs');
const { makeCli } = require('../../.forma/dashboard/lib/cli.cjs');
const { field: fm, labelsOf: labels } = require('../../.forma/dashboard/lib/card.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, '.forma/living', 'graphs');
const CACHE = path.join(OUT, '.kit-cache.json');
const BOARD = path.join(ROOT, '.devtool', 'features');
const CODES = ['value', 'docs', 'forma', 'result-image', 'core', 'incoming', 'goal', 'experience', 'review-image'];
const GOAL_LABEL = new RegExp('^goal-(\\d+|' + CODES.join('|') + ')$');

const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
const hash = s => crypto.createHash('sha1').update(s).digest('hex');
const list = (dir, test) => fs.existsSync(dir) ? fs.readdirSync(dir).filter(test).map(f => path.join(dir, f)) : [];

const cardId = f => (path.basename(f).match(/^(card-\d+)/) || [])[1] || path.basename(f, '.md');

// --- извлечение из одного файла: {nodes, edges} ------------------------------

function cardForGoals(f, text) {
  const id = cardId(f), goal = labels(text).find(l => GOAL_LABEL.test(l));
  const nodes = [{ id, label: id, type: 'card', status: fm(text, 'status') }];
  const edges = goal ? [{ source: id, target: goal, relation: 'serves' }] : [];
  return { nodes, edges };
}

function cardForBoard(f, text) {
  const id = cardId(f);
  const title = (text.match(/^# (.+)$/m) || [])[1] || id;
  const status = fm(text, 'status'), assignee = fm(text, 'assignee'), epic = fm(text, 'epic');
  const goal = labels(text).find(l => GOAL_LABEL.test(l));
  const nodes = [{ id, label: title, type: 'card', status, assignee }];
  const edges = [];
  if (goal) { nodes.push({ id: goal, label: goal, type: 'goal' }); edges.push({ source: id, target: goal, relation: 'serves' }); }
  if (epic) { nodes.push({ id: 'lane:' + epic, label: epic, type: 'lane' }); edges.push({ source: id, target: 'lane:' + epic, relation: 'in_lane' }); }
  if (assignee) { nodes.push({ id: 'node:' + assignee, label: assignee, type: 'node' }); edges.push({ source: id, target: 'node:' + assignee, relation: 'held_by' }); }
  // Файлы, которые карточка называет, — там, где задачи могут столкнуться.
  const seen = new Set();
  for (const m of text.matchAll(/`([\w.\-/]+\/[\w.\-]+\.(?:md|cjs|js|json|css|php|html|sh|toml))`/g)) {
    if (seen.has(m[1])) continue; seen.add(m[1]);
    nodes.push({ id: 'file:' + m[1], label: m[1], type: 'file' });
    edges.push({ source: id, target: 'file:' + m[1], relation: 'touches' });
  }
  return { nodes, edges };
}

function roadmapForGoals(f, text) {
  const nodes = [], edges = [];
  let main = null, depth = -1;
  for (const line of text.split('\n')) {
    if (!line.includes('── ')) continue;                 // только дерево карты
    const m = line.match(/^(.*?)(goal-[\w-]+)\s*·\s*(.+?)\s*$/);
    if (!m) continue;
    const [, pre, id, rest] = m;
    const isMain = CODES.some(c => id === 'goal-' + c);
    nodes.push({ id, label: rest, type: isMain ? 'main_goal' : 'subgoal', kind: isMain ? id.slice(5) : null });
    if (isMain) { main = id; depth = pre.length; }
    else if (main && pre.length > depth) edges.push({ source: id, target: main, relation: 'part_of' });
  }
  return { nodes, edges };
}

function agentForArsenal(f, text) {
  const name = fm(text, 'name') || path.basename(f, '.md');
  const node = 'node:' + name[0].toUpperCase() + name.slice(1);
  const nodes = [{ id: node, label: node.slice(5), type: 'node' }], edges = [];
  const tools = fm(text, 'tools') || '';
  for (const t of tools.split(/,(?![^(]*\))/).map(s => s.trim()).filter(Boolean)) {
    nodes.push({ id: 'tool:' + t, label: t, type: 'tool' });
    edges.push({ source: node, target: 'tool:' + t, relation: 'declares' });
  }
  return { nodes, edges };
}

function skillForArsenal(f, text) {
  const name = fm(text, 'name') || path.basename(path.dirname(f));
  return { nodes: [{ id: 'skill:' + name, label: name, type: 'skill', description: (fm(text, 'description') || '').slice(0, 160) }], edges: [] };
}

function mcpForArsenal(f, text) {
  let servers = {};
  try { servers = JSON.parse(text).mcpServers || {}; } catch { /* неразборный — пусто */ }
  return { nodes: Object.keys(servers).map(s => ({ id: 'mcp:' + s, label: s, type: 'mcp' })), edges: [] };
}

function scriptForArsenal(f) {
  return { nodes: [{ id: 'script:' + path.basename(f), label: path.basename(f), type: 'script' }], edges: [] };
}

// Журнал инструментов дописывается строками — разбирается целиком, но без модели.
function logForArsenal(f, text) {
  const counts = new Map();
  for (const line of text.split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue;
    const [, who, , tool] = line.split(' · ').map(s => s && s.trim());
    if (!who || !tool || who === '!ERROR' || who === '!ОШИБКА') continue;
    const node = 'node:' + (who === 'session' || who === 'сессия' ? 'Session' : who[0].toUpperCase() + who.slice(1));  // журнал пишет «kit», роль — «Kit»
    const key = node + '|' + tool;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const nodes = [], edges = [];
  for (const [key, n] of counts) {
    const [node, tool] = key.split('|');
    nodes.push({ id: node, label: node.slice(5), type: 'node' }, { id: 'tool:' + tool, label: tool, type: 'tool' });
    edges.push({ source: node, target: 'tool:' + tool, relation: 'used', weight: n });
  }
  return { nodes, edges };
}

// --- какие файлы питают какой граф -----------------------------------------------

function sources() {
  const open = list(BOARD, f => f.endsWith('.md'));
  const done = list(path.join(BOARD, 'done'), f => f.endsWith('.md'));
  const skillDirs = list(path.join(ROOT, '.claude', 'skills'), () => true)
    .map(d => path.join(d, 'SKILL.md')).filter(f => fs.existsSync(f));
  return {
    goals: [[[path.join(ROOT, 'project', 'ops', 'ROADMAP.md'), path.join(ROOT, 'project', 'ROADMAP.md')].find(f => fs.existsSync(f)) || path.join(ROOT, 'project', 'ops', 'ROADMAP.md'), roadmapForGoals],
            ...[...open, ...done].map(f => [f, cardForGoals])],
    board: open.map(f => [f, cardForBoard]),               // живая доска — без закрытых
    arsenal: [...list(path.join(ROOT, '.claude', 'agents'), f => f.endsWith('.md')).map(f => [f, agentForArsenal]),
              ...skillDirs.map(f => [f, skillForArsenal]),
              ...list(path.join(ROOT, '.claude', 'scripts'), f => /\.(cjs|js|sh)$/.test(f)).map(f => [f, scriptForArsenal]),
              ...[path.join(ROOT, '.mcp.json'), path.join(ROOT, '.claude', '.mcp.json')].filter(f => fs.existsSync(f)).map(f => [f, mcpForArsenal]),
              ...[path.join(ROOT, '.forma/dashboard', 'tool-usage.log')].filter(f => fs.existsSync(f)).map(f => [f, logForArsenal])],
  };
}

// --- сборка --------------------------------------------------------------------

function build(name, pairs, cache) {
  const slot = cache[name] || (cache[name] = {});
  let hit = 0, miss = 0;
  const alive = new Set();
  const nodes = new Map(), edges = [];
  for (const [file, extract] of pairs) {
    if (!fs.existsSync(file)) continue;
    const key = rel(file), text = fs.readFileSync(file, 'utf8'), h = hash(text);
    alive.add(key);
    let part = slot[key];
    if (part && part.hash === h && part.extractor === extract.name) hit++;
    else { part = { hash: h, extractor: extract.name, ...extract(file, text) }; slot[key] = part; miss++; }
    for (const n of part.nodes) nodes.set(n.id, { ...nodes.get(n.id), ...n, source_file: nodes.get(n.id)?.source_file || key });
    for (const e of part.edges) edges.push({ ...e, source_file: key });
  }
  let gone = 0;
  for (const key of Object.keys(slot)) if (!alive.has(key)) { delete slot[key]; gone++; }  // удалённый файл уходит со своими узлами
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'graph.json'), JSON.stringify({
    built: new Date().toISOString(), extractor: 'deterministic', model_tokens: 0,
    nodes: [...nodes.values()], edges,
  }, null, 1));
  return { name, nodes: nodes.size, edges: edges.length, hit, miss, gone };
}

function main() {
  const cli = makeCli();
  const only = cli.eq('only', '') || cli.value('only', '');
  const cache = readJson(CACHE, {}); // первый прогон — пустой кэш
  const src = sources();
  const rows = [];
  for (const name of Object.keys(src)) if (!only || only === name) rows.push(build(name, src[name], cache));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(cache));
  for (const r of rows) {
    console.log(`${r.name.padEnd(8)} ${String(r.nodes).padStart(5)} узлов ${String(r.edges).padStart(5)} рёбер · ` +
                `из кэша ${r.hit}, разобрано ${r.miss}, ушло ${r.gone} · модель: 0 токенов`);
  }
}

if (require.main === module) main();
module.exports = { build, sources };
