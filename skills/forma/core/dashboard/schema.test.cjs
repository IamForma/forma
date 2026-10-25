'use strict';
// Сборщик схемы движка: манифест, один блок на файл, «неразобранное», связи из реальных файлов.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildSchema } = require('./schema.cjs');
const M = require('./schema-manifest.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const real = buildSchema(ROOT);
// тесты по живому движку идут только в проекте; в исходнике протокола (другая раскладка) их нет
const LIVE = { skip: !(fs.existsSync(path.join(ROOT, 'AGENTS.md')) && fs.existsSync(path.join(ROOT, '.claude/settings.json'))) && 'not a project root' };

function tmpProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

test('manifest: english keys, labels ru and en apart', () => {
  for (const b of M.BLOCKS) {
    assert.match(b.key, /^[a-z][a-z0-9_]*$/, b.key);
    assert.ok(b.ru && b.en && b.descRu && b.descEn, b.key + ' labels');
  }
  for (const t of M.LINK_TYPES) { assert.match(t.key, /^[a-z]+$/); assert.ok(t.ru && t.en); }
  assert.deepEqual(M.LINK_TYPES.map((t) => t.key), ['reads', 'writes', 'calls', 'registers', 'spawns']);
  assert.equal(new Set(M.BLOCKS.map((b) => b.key)).size, M.BLOCKS.length);
  for (const r of M.RULES) assert.ok(M.BLOCKS.some((b) => b.key === r.block), 'rule block ' + r.glob);
  for (const a of M.AREAS) assert.ok(M.BLOCKS.some((b) => b.key === a.block), 'area block ' + a.prefix);
});

test('every file is in exactly one block', LIVE, () => {
  const seen = new Map();
  for (const b of real.blocks) for (const f of b.files) { assert.ok(!seen.has(f), 'twice: ' + f); seen.set(f, b.key); }
  const sorted = real.files.filter((f) => f.block).map((f) => f.path);
  assert.equal(seen.size, sorted.length);
  assert.deepEqual([...seen.keys()].sort(), sorted.slice().sort());
  assert.equal(seen.size + real.unsorted.length, real.files.length);
  assert.deepEqual(real.unsorted, [], 'unsorted: ' + real.unsorted.join(', '));
});

test('every block of the tz is covered and non-empty', LIVE, () => {
  for (const k of ['rules', 'nodes', 'board', 'economy', 'checks', 'hooks', 'knowledge', 'dashboard', 'protocol', 'outputs']) {
    assert.ok(real.blocks.find((b) => b.key === k).files.length > 0, k);
  }
});

test('an undescribed new file lands in "unsorted"', () => {
  const dir = tmpProject({ 'AGENTS.md': '# law\n', '.codex/zz-new-file.dat': 'x' });
  const s = buildSchema(dir);
  assert.deepEqual(s.unsorted, ['.codex/zz-new-file.dat']);
  assert.equal(s.files.find((f) => f.path === 'AGENTS.md').block, 'rules');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('every file has "does" and "caller" or is named in gaps', LIVE, () => {
  for (const f of real.files) {
    if (!f.does) assert.ok(real.gaps.noDoes.includes(f.path), 'noDoes: ' + f.path);
    if (f.callerKind === 'none') assert.ok(real.gaps.noCaller.includes(f.path), 'noCaller: ' + f.path);
    else assert.ok(f.caller, 'caller: ' + f.path);
  }
  const withDoes = real.files.filter((f) => f.does).length;
  assert.ok(withDoes / real.files.length > 0.8, 'does coverage ' + withDoes + '/' + real.files.length);
});

test('hooks come from settings.json, not from hand', LIVE, () => {
  const settings = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude/settings.json'), 'utf8'));
  const cmds = JSON.stringify(settings.hooks).match(/\.claude\/(hooks|scripts)\/[\w.-]+/g) || [];
  assert.ok(cmds.length > 0);
  for (const c of new Set(cmds)) {
    assert.ok(real.links.some((l) => l.type === 'registers' && l.from === '.claude/settings.json' && l.to === c), 'registers ' + c);
  }
  for (const l of real.links.filter((x) => x.type === 'registers')) assert.match(l.from, /(settings|hooks)\.json$/);
});

test('registers, calls and writes are built from a synthetic project', () => {
  const dir = tmpProject({
    '.claude/settings.json': JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node .claude/scripts/a.cjs' }] }] } }),
    '.claude/scripts/a.cjs': "const b = require('./b.cjs');\nrequire('fs').appendFileSync('.claude/.ledger/calls.jsonl', 'x');\n",
    '.claude/scripts/b.cjs': '// helper\n',
  });
  const s = buildSchema(dir);
  const has = (from, to, type) => s.links.some((l) => l.from === from && l.to === to && l.type === type);
  assert.ok(has('.claude/settings.json', '.claude/scripts/a.cjs', 'registers'));
  assert.ok(has('.claude/scripts/a.cjs', '.claude/scripts/b.cjs', 'calls'));
  assert.ok(has('.claude/scripts/a.cjs', 'area:.claude/.ledger', 'writes'));
  assert.equal(s.files.find((f) => f.path === '.claude/scripts/a.cjs').caller, '.claude/settings.json');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('links: known types, known blocks, endpoints exist, evidence is in the source file', LIVE, () => {
  const types = new Set(M.LINK_TYPES.map((t) => t.key));
  const blocks = new Set(M.BLOCKS.map((b) => b.key));
  const paths = new Set(real.files.map((f) => f.path));
  assert.ok(real.links.length > 100);
  const kinds = new Set(real.links.map((l) => l.type));
  for (const k of types) assert.ok(kinds.has(k), 'no links of type ' + k);
  for (const l of real.links) {
    assert.ok(types.has(l.type) && blocks.has(l.fromBlock) && blocks.has(l.toBlock));
    assert.ok(paths.has(l.from));
    assert.ok(paths.has(l.to) || l.to.startsWith('area:'), l.to);
  }
  for (const l of real.links.slice(0, 400)) {
    const src = fs.readFileSync(path.join(ROOT, l.from), 'utf8');
    const base = l.to.startsWith('area:') ? l.to.slice(5) : path.posix.basename(l.to, path.posix.extname(l.to));
    assert.ok(src.includes(base) || /['"`]\s*,\s*['"`]/.test(src), `${l.from} does not mention ${base}`);
  }
});

test('ENGINE-MAP tokens are resolved against the real files', LIVE, () => {
  assert.ok(real.engineMap.tokens > 100);
  assert.ok(real.engineMap.resolved.length > real.engineMap.unresolved.length * 5);
  for (const u of real.engineMap.unresolved) assert.ok(u.token, 'unresolved entry has token');
});
