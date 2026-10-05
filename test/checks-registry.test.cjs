// Реестры проверок (доска — ядро; сверка движка Claude Code): у каждой проверки есть файл и строка в реестре,
// форма соблюдена, а на фикстуре с минимальной порчей проверка «ловит» (находка по её id), на чистой — «не ловит».
// Тексты вывода целиком — checks-output.test.cjs; здесь — поведение каждой проверки по отдельности.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { makeFixture } = require('./helpers/fixture.cjs');
const { mutator } = require('./helpers/mutate.cjs');
const { CASES, CHECKS_JSON } = require('./helpers/check-cases.cjs');

let fx;
let BOARD;
let SYNC;
let lib;
let parity;
const load = (rel) => require(path.join(fx.root, ...rel.split('/')));

test.before(() => {
  fx = makeFixture();
  mutator(fx.root).write('.forma/living/checks.json', JSON.stringify(CHECKS_JSON, null, 2) + '\n');
  lib = load('.forma/dashboard/lib/checks.cjs');
  BOARD = load('.forma/board/checks/index.cjs');
  SYNC = load('.claude/scripts/checks/index.cjs');
  parity = load('.claude/scripts/checks/support/role-parity.cjs');
});
test.after(() => { if (fx) fx.cleanup(); });

const registryOf = (c) => (c.registry === 'board' ? BOARD : SYNC);
const byId = (registry, id) => registry.find((check) => check.id === id);
const findings = (check, info = []) => lib.runChecks([check], { root: fx.root, info });

test('реестры: форма соблюдена (id латиницей и уникален, since — ключ или null, run — функция)', () => {
  assert.deepEqual(lib.validateChecks(BOARD), []);
  assert.deepEqual(lib.validateChecks(SYNC), []);
});

test('реестр сверки собран из реестра доски: те же модули, в том же порядке', () => {
  const ids = SYNC.map((c) => c.id);
  const from = ids.indexOf(BOARD[0].id);
  assert.deepEqual(ids.slice(from, from + BOARD.length), BOARD.map((c) => c.id));
});

test('validateChecks: ловит чужой id, повтор, кривой since, run не функцией', () => {
  const ok = { id: 'good-one', since: null, run: () => [] };
  assert.deepEqual(lib.validateChecks([ok]), []);
  assert.match(lib.validateChecks([{ ...ok, id: 'Bad_Id' }]).join('\n'), /ждали латиницу через дефис/);
  assert.match(lib.validateChecks([ok, ok]).join('\n'), /good-one: id встречается дважды/);
  assert.match(lib.validateChecks([{ ...ok, since: 5 }]).join('\n'), /good-one: since — ключ правила или null/);
  assert.match(lib.validateChecks([{ ...ok, run: 'x' }]).join('\n'), /good-one: run — не функция/);
});

test('runChecks: день вступления берётся из living/checks.json, порядок находок — порядок реестра', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-since-'));
  try {
    fs.mkdirSync(path.join(root, '.forma', 'living'), { recursive: true });
    fs.writeFileSync(path.join(root, '.forma', 'living', 'checks.json'), JSON.stringify({ known: '2030-05-05' }));
    const seen = [];
    const spy = (id, since) => ({ id, since, run: (ctx) => { seen.push([id, ctx.since]); return [id]; } });
    const out = lib.runChecks([spy('a-first', 'known'), spy('b-second', null), spy('c-third', 'fresh')], { root });
    assert.deepEqual(out, ['a-first', 'b-second', 'c-third']);
    assert.deepEqual(seen[0], ['a-first', '2030-05-05']);
    assert.deepEqual(seen[1], ['b-second', null]);
    assert.match(seen[2][1], /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.forma', 'living', 'checks.json'), 'utf8')).fresh, seen[2][1]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('каждый файл проверки — в реестре, id равен имени файла; лишних строк в реестре нет', () => {
  const dirs = [['.forma/board/checks', BOARD], ['.forma/dashboard/checks', SYNC], ['.claude/scripts/checks', SYNC]];
  for (const [dir, registry] of dirs) {
    const files = fs.readdirSync(path.join(fx.root, dir)).filter((f) => f.endsWith('.cjs') && f !== 'index.cjs');
    for (const f of files) {
      const id = f.replace(/\.cjs$/, '');
      assert.ok(byId(registry, id), `${dir}/${f}: проверки «${id}» нет в реестре — нужна строка в index.cjs`);
      assert.equal(load(`${dir}/${f}`).id, id, `${dir}/${f}: id не равен имени файла`);
    }
  }
  for (const check of BOARD) assert.ok(fs.existsSync(path.join(fx.root, '.forma', 'board', 'checks', check.id + '.cjs')), `${check.id}: нет файла`);
});

test('чистая фикстура: ни одна проверка обоих реестров ничего не находит', () => {
  for (const check of SYNC) {
    const info = [];
    assert.deepEqual(findings(check, info), [], `${check.id}: находки на чистой фикстуре`);
    assert.deepEqual(info.filter((l) => /Codex/.test(l)), [], `${check.id}: сведения о Codex на чистой фикстуре`);
  }
});

for (const c of CASES.filter((x) => x.id)) {
  test(`порча «${c.name}»: проверка «${c.id}» ловит, остальные — нет`, () => {
    const m = mutator(fx.root);
    try {
      c.apply(m);
      const registry = registryOf(c);
      const target = byId(registry, c.id);
      assert.ok(target, `${c.id}: нет в реестре ${c.registry}`);
      const info = [];
      const found = findings(target, info);
      if (c.expect) assert.match(found.join('\n'), c.expect, `${c.id}: не поймала порчу «${c.name}»`);
      else assert.deepEqual(found, [], `${c.id}: сведения не должны быть находками`);
      if (c.expectInfo) assert.match(info.join('\n'), c.expectInfo, `${c.id}: нет сведения о порче «${c.name}»`);
      const needle = c.expect || c.expectInfo;
      for (const other of registry.filter((x) => x.id !== c.id)) {
        const otherInfo = [];
        const text = findings(other, otherInfo).concat(otherInfo).join('\n');
        assert.doesNotMatch(text, needle, `${other.id}: ловит чужую порчу «${c.name}»`);
      }
    } finally {
      m.restore();
    }
  });
}

test('паритет ролей: одинаковые тексты — synced, разные — drift, одного файла нет — missing', () => {
  const core = '.agents/plugins/forma/agents/core.md';
  const m = mutator(fx.root);
  try {
    const pairOf = () => parity.compareRoles(fx.root).find((r) => r.pair.name === 'Agent: Core').res;
    assert.equal(pairOf().status, 'missing_gemini');
    m.write(core, m.read('.claude/agents/core.md'));
    assert.equal(pairOf().status, 'synced');
    m.write(core, '# другая роль\n');
    assert.equal(pairOf().status, 'drift');
    assert.match(pairOf().diff, /Line 1:/);
  } finally {
    m.restore();
  }
});

test('нормализация ролей: концы строк и имя файла правил не считаются расхождением', () => {
  const a = parity.normalizeText('---\nmodel: x\n---\nСм. CLAUDE.md  \r\nконец\r\n', 'agent');
  const b = parity.normalizeText('---\nmodel: y\n---\nСм. gemini-8.md\nконец\n', 'agent');
  assert.equal(a, b);
  assert.notEqual(parity.normalizeText('a\n', 'other'), parity.normalizeText('b\n', 'other'));
});
