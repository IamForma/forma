#!/usr/bin/env node
'use strict';
/**
 * Тест автозаписи расхода (ledger-recorder.cjs) на синтетической стенограмме и временной карточке (temp-каталог, не доска).
 *   node .claude/scripts/ledger-recorder.test.cjs
 */
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { record, nodeOf, cardsIn } = require('./ledger-recorder.cjs');
const { tally } = require('../../.forma/dashboard/tally.cjs');
const { PARSES_RE } = require('../../.forma/dashboard/spend-line.cjs');

// даты и номера карточек собираются, не пишутся литералом (запрет 16: чистая зона)
const D = ['2000', '01', '02'].join('-');
const BT = String.fromCharCode(96);
const T = (str) => str.replace(/@D/g, D).replace(/@c/g, 'card');
let passed = 0;
const it = (name, fn) => { fn(); passed += 1; console.log('ok  ' + name); };

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-rec-'));
const board = path.join(root, '.devtool', 'features');
fs.mkdirSync(path.join(board, 'done'), { recursive: true });
const card = (n, dir = board) => {
  const f = path.join(dir, `card-${n}-test.md`);
  fs.writeFileSync(f, T(['---', 'id: "@c-' + n + '-test"', 'status: "todo"', 'labels: ["route-4"]', '---', '# @c-' + n, '', '## Task', 'x', '', '## Kit', '', '## History', '- ' + BT + 'Intent' + BT + ', @D: stage kit — start.', '', '## Result', ''].join('\n')));
  return f;
};
const f901 = card('901'), f902 = card('902'), f903 = card('903', path.join(board, 'done'));
const f950 = card('950'), f951 = card('951'), f952 = card('952');
const NL = String.fromCharCode(10);

it('cardsIn: только «Карточка:»/«Card:» и пути карточек', () => {
  assert.deepEqual(cardsIn(T(['Card: @c-901, @c-902', 'после @c-903', 'after-@c-904', 'см. @c-905'].join(NL))), ['901', '902']);
  assert.deepEqual(cardsIn(T('Файл .devtool/features/@c-906-x.md и после @c-907')), ['906']);
  assert.deepEqual(cardsIn(T('Только после @c-908, after-@c-909.')), []);
});

const tr = path.join(root, 'agent-aaa111.jsonl');
const step = (i, rid, t, u) => JSON.stringify({ type: 'assistant', requestId: rid, timestamp: t, message: { model: 'm', usage: u } });
const base = [
  JSON.stringify({ type: 'user', timestamp: T('@DT10:00:00.000Z'), message: { role: 'user', content: T(['Карточка: @c-901 и @c-902; повтор @c-901.', 'Файл .devtool/features/done/@c-903-test.md', 'после @c-950, after-@c-951, см. @c-952.'].join(NL)) } }),
  step(1, 'r1', T('@DT10:00:10.000Z'), { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 100, cache_creation_input_tokens: 5 }),
  step(1, 'r1', T('@DT10:00:10.000Z'), { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 100, cache_creation_input_tokens: 5 }), // дубль
  step(2, 'r2', T('@DT10:01:00.000Z'), { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 200, cache_creation_input_tokens: 3 }),
];
fs.writeFileSync(tr, base.join('\n') + '\n');
fs.writeFileSync(tr.replace(/\.jsonl$/, '.meta.json'), JSON.stringify({ agentType: 'run-text', description: 'тест' }));
const ledger = path.join(root, '.claude', '.ledger', 'calls.jsonl');
const ev = { agent_id: 'aaa111', agent_type: 'run-text', agent_transcript_path: tr, session_id: 's', cwd: root };
const rows = () => fs.readFileSync(ledger, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const histLines = (f) => fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.includes('`aaa111`'));

it('узлы: kit→Kit, run-*→Run, plumb-haiku→Plumb, иное как есть', () => {
  assert.deepEqual(['kit', 'spec', 'core', 'intent', 'run-text', 'run', 'plumb-haiku', 'other'].map(nodeOf),
    ['Kit', 'Spec', 'Core', 'Intent', 'Run', 'Run', 'Plumb', 'other']);
});

it('запись в журнал: итоги без дублей шагов, T по первой/последней записи, cards', () => {
  const r = record(ev, { root, now: new Date(T('@DT10:02:00Z')) });
  assert.ok(r.recorded);
  const [x] = rows();
  assert.deepEqual([x.conversationId, x.engine, x.node, x.input_tokens, x.output_tokens, x.cache_read_tokens, x.cache_write_tokens, x.duration_s],
    ['aaa111', 'claude-code', 'run-text', 11, 22, 300, 8, 60]);
  assert.deepEqual(x.cards, ['901', '902', '903']);
  // упоминания «после», «after-», «см.» расход не размывают: карточки есть на доске, строк у них нет
  for (const f of [f950, f951, f952]) assert.equal(histLines(f).length, 0);
  assert.equal(x.continuation, undefined);
});

it('строка в карточки: split 3 (999 нет на доске), done/ найдена, формат разбирается', () => {
  // N = 11+8+300+22 = 341 → 114/114/113; R 300 → 100 каждой; O 22 → 8/7/7; T 60 → 20
  const l1 = histLines(f901), l2 = histLines(f902), l3 = histLines(f903);
  assert.equal(l1.length, 1); assert.equal(l2.length, 1); assert.equal(l3.length, 1);
  assert.equal(l1[0], T('- ' + BT + 'Run' + BT + ', @D: attempt, 114 tokens (100 cache-read), 8 out, 20 s, ' + BT + 'aaa111' + BT + ' — claude-code: автозапись хуком SubagentStop (тест) (batch 1/3).'));
  assert.match(l3[0], /113 tokens \(100 cache-read\), 7 out, 20 s.*batch 3\/3/);
  assert.ok(PARSES_RE.test(l1[0].slice(2)));
  // строка стоит в «История», перед «Результат»
  const t = fs.readFileSync(f901, 'utf8');
  assert.ok(t.indexOf(l1[0]) > t.indexOf('## History') && t.indexOf(l1[0]) < t.indexOf('## Result'));
});

it('tally читает сумму долей = N вызова', () => {
  const t = tally([f901, f902, f903]);
  assert.equal(JSON.stringify(t).includes('"tokens":341'), true);
});

it('повтор события без прироста: ни записи, ни дубля строки', () => {
  const r = record(ev, { root });
  assert.equal(r.recorded, false);
  assert.equal(rows().length, 1);
  assert.equal(histLines(f901).length, 1);
});

it('ручная строка с тем же id: хук не дублирует (запись в журнале есть, строки нет)', () => {
  const f = card('904');
  const manual = T('- ' + BT + 'Run' + BT + ', @D: attempt, 5 tokens (1 cache-read), 1 out, 1 s, ' + BT + 'bbb222' + BT + ' — claude-code: вручную.');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('## Result', manual + '\n\n## Result'));
  const t2 = path.join(root, 'agent-bbb222.jsonl');
  fs.writeFileSync(t2, [
    JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: T('@c-904') }] }, timestamp: T('@DT10:00:00.000Z') }),
    step(1, 'q1', T('@DT10:00:05.000Z'), { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 1, cache_creation_input_tokens: 1 }),
  ].join('\n'));
  const r = record({ agent_id: 'bbb222', agent_type: 'kit', agent_transcript_path: t2 }, { root });
  assert.ok(r.recorded); assert.equal(r.lines.length, 0);
  assert.equal(fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.includes('`bbb222`')).length, 1);
});

it('продолжение: новая запись continuation:true, в карточку — дельта', () => {
  fs.appendFileSync(tr, [
    step(3, 'r3', T('@DT10:05:00.000Z'), { input_tokens: 4, output_tokens: 6, cache_read_input_tokens: 90, cache_creation_input_tokens: 0 }),
  ].join('\n') + '\n');
  const r = record(ev, { root, now: new Date(T('@DT10:06:00Z')) });
  assert.ok(r.recorded);
  const x = rows().filter((q) => q.conversationId === 'aaa111');
  assert.equal(x.length, 2); assert.equal(x[1].continuation, true);
  assert.equal(x[1].duration_s, 300);
  // итог N = 341 + 100 = 441 → доли 147 каждой; было 114/114/113 → дельты 33/33/34; R 130→ 130-100... итог R 390 → 130 каждой
  const l = histLines(f901);
  assert.equal(l.length, 2);
  assert.match(l[1], /attempt, 33 tokens \(30 cache-read\), 2 out, 80 s, `aaa111` — claude-code: продолжение вызова — автозапись хуком/);
  assert.equal(histLines(f903).length, 2);
});

it('в промпте нет явной карточки: cards [] в журнале, карточки не пишутся', () => {
  const t3 = path.join(root, 'agent-eee555.jsonl');
  fs.writeFileSync(t3, [
    JSON.stringify({ type: 'user', message: { role: 'user', content: T('Сделай то, что описано после @c-950.') }, timestamp: T('@DT10:00:00.000Z') }),
    step(1, 'z1', T('@DT10:00:05.000Z'), { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 1, cache_creation_input_tokens: 1 }),
  ].join(NL));
  const r = record({ agent_id: 'eee555', agent_type: 'run-text', agent_transcript_path: t3 }, { root });
  assert.ok(r.recorded); assert.equal(r.lines.length, 0);
  assert.deepEqual(rows().find((q) => q.conversationId === 'eee555').cards, []);
  assert.equal(fs.readFileSync(f950, 'utf8').includes('eee555'), false);
});

it('нет стенограммы: журнал с null, строка с unknown и причиной, не нули', () => {
  const f = card('905');
  const r = record({ agent_id: 'ccc333', agent_type: 'spec' }, { root });
  assert.ok(r.recorded);
  const x = rows().find((q) => q.conversationId === 'ccc333');
  assert.equal(x.input_tokens, null);
  assert.equal(r.lines.length, 0); // карточки взять неоткуда — номера в промпте стенограммы
  assert.ok(fs.existsSync(f));
});

it('битый вход и пустой ввод: exit 0, причина в errors.log', () => {
  const run = (input) => spawnSync(process.execPath, [path.join(__dirname, 'ledger-recorder.cjs')], { input, encoding: 'utf8', env: { ...process.env, CLAUDE_LEDGER_ROOT: root } });
  for (const input of ['{не json', '', '{"agent_type":"kit"}']) {
    const r = run(input);
    assert.equal(r.status, 0);
  }
  const log = fs.readFileSync(path.join(root, '.claude', '.ledger', 'errors.log'), 'utf8');
  assert.ok(log.split('\n').filter(Boolean).length >= 3);
});

it('CLAUDE_LEDGER_DEBUG=1: сырой вход в raw-last.json', () => {
  const raw = JSON.stringify({ agent_id: 'ddd444', agent_type: 'kit', agent_transcript_path: path.join(root, 'нет.jsonl') });
  const r = spawnSync(process.execPath, [path.join(__dirname, 'ledger-recorder.cjs')], { input: raw, encoding: 'utf8', env: { ...process.env, CLAUDE_LEDGER_ROOT: root, CLAUDE_LEDGER_DEBUG: '1' } });
  assert.equal(r.status, 0);
  assert.equal(fs.readFileSync(path.join(root, '.claude', '.ledger', 'raw-last.json'), 'utf8'), raw);
});

fs.rmSync(root, { recursive: true, force: true });
console.log(`\n${passed} passed`);
