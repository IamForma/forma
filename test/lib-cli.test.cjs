// Модульные тесты dashboard/lib/cli.cjs: четыре способа читать argv.
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeCli, parseOptions, parseKnown, parseLong } = require('../skills/forma/core/dashboard/lib/cli.cjs');

test('makeCli.flag: флаг есть или нет', () => {
  const c = makeCli(['--dry', 'x']);
  assert.equal(c.flag('dry'), true);
  assert.equal(c.flag('wet'), false);
});

test('makeCli.arg: значение после флага; нет значения или дальше флаг — запасное', () => {
  const c = makeCli(['--kind', 'forma', '--bare', '--after', '--x']);
  assert.equal(c.arg('kind'), 'forma');
  assert.equal(c.arg('bare', 'd'), 'd');
  assert.equal(c.arg('after', 'd'), 'd');
  assert.equal(c.arg('нет', 'd'), 'd');
});

test('makeCli.value: сырое следующее слово; флаг последний — undefined; флага нет — запасное', () => {
  const c = makeCli(['--a', '--b', '--last']);
  assert.equal(c.value('a'), '--b');
  assert.equal(c.value('last', 'd'), undefined);
  assert.equal(c.value('нет', 'd'), 'd');
});

test('makeCli.values: все значения повторяемого флага', () => {
  assert.deepEqual(makeCli(['--over', '1', '--x', '--over', '2']).values('over'), ['1', '2']);
});

test('makeCli.eq: форма --имя=значение; значение — весь хвост после первого «=»', () => {
  const c = makeCli(['--only=board', '--q=a=b']);
  assert.equal(c.eq('only', ''), 'board');
  assert.equal(c.eq('q'), 'a=b');
  assert.equal(c.eq('нет', 'd'), 'd');
});

test('makeCli.positional: слова без «--»', () => {
  assert.deepEqual(makeCli(['record', '--a', 'b', 'c']).positional(), ['record', 'b', 'c']);
});

test('makeCli.die: сообщение с префиксом в stderr, код 2', () => {
  const realExit = process.exit, realErr = console.error;
  let code, msg;
  process.exit = (c) => { code = c; };
  console.error = (m) => { msg = m; };
  try { makeCli([]).die('tool')('плохо'); } finally { process.exit = realExit; console.error = realErr; }
  assert.equal(code, 2);
  assert.equal(msg, 'tool: плохо');
});

test('parseOptions: флаг без значения — true и не съедает соседний флаг', () => {
  assert.deepEqual(parseOptions(['--from-transcript', '--card', '143', '--end']), { 'from-transcript': true, card: '143', end: true });
});

test('parseOptions greedy: следующее слово всегда значение', () => {
  assert.deepEqual(parseOptions(['--a', '--b', 'c'], { greedy: true }), { a: '--b' });
  assert.deepEqual(parseOptions(['--last'], { greedy: true }), { last: undefined });
});

test('parseKnown: только известные флаги, с преобразованием, поверх заготовки', () => {
  const int = (v) => parseInt(v, 10);
  const spec = { '--prompt': 'prompt', '--max-tokens': ['maxTokens', int] };
  const out = parseKnown(['--prompt', 'hi', '--unknown', 'z', '--max-tokens', '42'], spec, { maxTokens: 8192 });
  assert.deepEqual(out, { maxTokens: 42, prompt: 'hi' });
  assert.deepEqual(parseKnown(['--toString', 'x'], spec, {}), {}, 'имена Object.prototype не считаются флагами');
});

test('parseLong: --ключ=значение, --ключ значение, булевы и остальное', () => {
  const { opts, rest } = parseLong(['init', '--dir=/p', '--engines', 'claude', '--yes', 'tail'], ['yes']);
  assert.deepEqual(opts, { dir: '/p', engines: 'claude', yes: true });
  assert.deepEqual(rest, ['init', 'tail']);
  assert.deepEqual(parseLong(['--last']).opts, { last: undefined });
});
