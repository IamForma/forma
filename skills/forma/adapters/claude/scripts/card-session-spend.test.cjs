#!/usr/bin/env node
'use strict';
/**
 * Тест режима `--auto` card-session-spend.cjs (хук SessionEnd) на синтетическом журнале сессии и временной доске.
 *   node .claude/scripts/card-session-spend.test.cjs
 */
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'card-session-spend.cjs');
const D = ['2000', '01', '02'].join('-');
const NL = String.fromCharCode(10);
const BT = String.fromCharCode(96);
let passed = 0;
const it = (name, fn) => { fn(); passed += 1; console.log('ok  ' + name); };

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spend-auto-'));
const projects = path.join(root, 'journals');
const board = path.join(root, '.devtool', 'features');
fs.mkdirSync(board, { recursive: true });
fs.mkdirSync(projects, { recursive: true });
const card = (n) => {
  const f = path.join(board, 'card-' + n + '-test.md');
  fs.writeFileSync(f, ['---', 'id: "card-' + n + '-test"', 'status: "todo"', '---', '# card-' + n, '', '## Task', 'x', '', '## History',
    '- ' + BT + 'Intent' + BT + ', ' + D + ': stage kit — start.', '', '## Result', ''].join(NL));
  return f;
};
const f901 = card('901'), f902 = card('902'), f903 = card('903');
const SID = 'sess-1111';
const journal = path.join(projects, SID + '.jsonl');
let mid = 0;
const human = (min) => JSON.stringify({ type: 'user', timestamp: D + 'T10:' + min + ':00.000Z', message: { role: 'user', content: 'сделай' } });
const edit = (min, file, extra = 0) => JSON.stringify({
  type: 'assistant', timestamp: D + 'T10:' + min + ':30.000Z',
  message: { id: 'm' + (++mid), content: [{ type: 'tool_use', name: 'Edit', input: { file_path: file } }],
    usage: { input_tokens: 10, output_tokens: 20 + extra, cache_read_input_tokens: 100, cache_creation_input_tokens: 5 } },
});
const write = (rows) => fs.writeFileSync(journal, rows.join(NL) + NL);
const run = (args, input, env = {}) => spawnSync(process.execPath, [SCRIPT, ...args], {
  input, encoding: 'utf8', env: { ...process.env, CLAUDE_SPEND_ROOT: root, CLAUDE_SPEND_PROJECTS: projects, ...env },
});
const spendLines = (f) => fs.readFileSync(f, 'utf8').split(NL).filter((l) => l.includes('card-session-spend'));
const event = JSON.stringify({ session_id: SID });

const rows1 = [human('00'), edit('01', f901), human('02'), edit('03', f902), human('04'), edit('05', f901)];
write(rows1);

it('--auto: строка на каждую затронутую карточку, нетронутой — нет', () => {
  const r = run(['--auto'], event);
  assert.equal(r.status, 0);
  assert.equal(spendLines(f901).length, 1);
  assert.equal(spendLines(f902).length, 1);
  assert.equal(spendLines(f903).length, 0);
  assert.match(spendLines(f901)[0], new RegExp('Intent' + BT + ', ' + D + ': attempt, \\d[\\d ]* tokens .* ' + BT + SID + BT + ' — '));
});

it('повторный --auto без новых ответов ничего не пишет', () => {
  const r = run(['--auto'], event);
  assert.equal(r.status, 0);
  assert.equal(spendLines(f901).length, 1);
  assert.equal(spendLines(f902).length, 1);
});

it('новые ответы → вторая строка только за них (граница окна)', () => {
  write([...rows1, human('06'), edit('07', f901, 5)]);
  const r = run(['--auto'], event);
  assert.equal(r.status, 0);
  assert.equal(spendLines(f901).length, 2);
  assert.equal(spendLines(f902).length, 1);
  assert.match(spendLines(f901)[1], / 140 tokens \(100 cache-read\), 25 out,/);
});

it('дедуп с ручным запуском: после ручной строки хук не дублирует, до — ручной видит хуковую', () => {
  const f = card('904');
  write([human('00'), edit('01', f)]);
  const m = run(['904', '--write'], '');
  assert.equal(m.status, 0);
  assert.equal(spendLines(f).length, 1);
  const a = run(['--auto'], event);
  assert.equal(a.status, 0);
  assert.equal(spendLines(f).length, 1);
  // обратный порядок: хук первым, ручной после
  const g = card('905');
  write([human('00'), edit('01', g)]);
  run(['--auto'], event);
  assert.equal(spendLines(g).length, 1);
  const m2 = run(['905', '--write'], '');
  assert.equal(m2.status, 0);
  assert.equal(spendLines(g).length, 1);
});

it('тихий отказ: битый вход, нет журнала сессии, нет каталога журналов — exit 0', () => {
  assert.equal(run(['--auto'], '{не json').status, 0);
  assert.equal(run(['--auto'], JSON.stringify({ session_id: 'нет-такой' })).status, 0);
  assert.equal(run(['--auto'], '', { CLAUDE_SPEND_PROJECTS: path.join(root, 'нет') }).status, 0);
});

it('ручной режим по-прежнему требует номер карточки', () => {
  assert.equal(run([], '').status, 2);
});

fs.rmSync(root, { recursive: true, force: true });
console.log(NL + passed + ' passed');
