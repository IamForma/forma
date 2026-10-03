// Модульные тесты dashboard/lib/card.cjs, rules.cjs и общих регулярок строки расхода (spend-line.cjs).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const card = require('../skills/forma/core/dashboard/lib/card.cjs');
const { ruleSince } = require('../skills/forma/core/dashboard/lib/rules.cjs');
const S = require('../skills/forma/core/dashboard/spend-line.cjs');

const CARD = [
  '---', 'id: "card-001-x"', 'status: "review"', 'assignee: null', 'created: "2026-05-04T10:00:00Z"',
  'labels: ["goal-forma", "route-4"]', 'priority: medium', '---', '', '# Заголовок  ', '', '## Задача', 'делай', '',
  '## История', '- `Kit`, 2026-05-04: attempt, 10 tokens (5 cache-read), 3 s, `abc12345` — claude-code: x.', '', '## Результат', 'готово', '',
].join('\n');

test('frontmatterBlock / splitFrontmatter: блок и тело; LF и CRLF; нет блока', () => {
  assert.match(card.frontmatterBlock(CARD), /^id: "card-001-x"/);
  assert.equal(card.frontmatterBlock(CARD.replace(/\n/g, '\r\n')).split('\r\n')[0], 'id: "card-001-x"');
  assert.equal(card.frontmatterBlock('# без блока'), null);
  const { block, rest } = card.splitFrontmatter(CARD);
  assert.ok(block.includes('status: "review"'));
  assert.ok(rest.startsWith('\n# Заголовок'));
  assert.deepEqual(card.splitFrontmatter('текст'), { block: null, rest: 'текст' });
});

test('parseFrontmatter: null, строка, массив, сырое значение', () => {
  assert.deepEqual(card.parseFrontmatter(CARD), {
    id: 'card-001-x', status: 'review', assignee: null, created: '2026-05-04T10:00:00Z',
    labels: ['goal-forma', 'route-4'], priority: 'medium',
  });
  assert.deepEqual(card.parseFrontmatter('без блока'), {});
});

test('parseFrontmatterJson: значение как JSON, иначе строка', () => {
  const fm = card.parseFrontmatterJson(CARD);
  assert.deepEqual(fm.labels, ['goal-forma', 'route-4']);
  assert.equal(fm.assignee, null);
  assert.equal(fm.priority, 'medium');
});

test('parseFlatFrontmatter: плоские поля роли без кавычек и тело', () => {
  const [o, body] = card.parseFlatFrontmatter('---\nname: "kit"\nmodel: sonnet\n---\nТело\n');
  assert.deepEqual(o, { name: 'kit', model: 'sonnet' });
  assert.equal(body, 'Тело\n');
  assert.deepEqual(card.parseFlatFrontmatter('Тело'), [{}, 'Тело']);
});

test('field / labelsOf / createdDay / cardTitle', () => {
  assert.equal(card.field(CARD, 'status'), 'review');
  assert.equal(card.field(CARD, 'assignee'), null);
  assert.equal(card.field(CARD, 'нет'), null);
  assert.deepEqual(card.labelsOf(CARD), ['goal-forma', 'route-4']);
  assert.deepEqual(card.labelsOf('без меток'), []);
  assert.equal(card.createdDay(CARD), '2026-05-04');
  assert.equal(card.createdDay('---\n---'), '');
  assert.equal(card.cardTitle(CARD), 'Заголовок');
  assert.equal(card.cardTitle('без заголовка'), null);
});

test('zone / zoneHeading / withoutHistory: два языка', () => {
  assert.equal(card.zone(CARD, 'task'), 'делай');
  assert.equal(card.zone(CARD, 'result'), 'готово');
  assert.equal(card.zone(CARD, 'kit'), '');
  const en = '## Task\ndo\n\n## History\n- h\n\n## Result\nok\n';
  assert.equal(card.zone(en, 'task'), 'do');
  assert.equal(card.zone(en, 'history'), '- h');
  assert.equal(card.zoneHeading('history', 'ru'), 'История');
  assert.equal(card.zoneHeading('history', 'en'), 'History');
  assert.equal(card.zoneHeading('history', 'de'), 'History');
  assert.ok(card.HISTORY_HEADING_RE.test('## История') && card.HISTORY_HEADING_RE.test('## History  '));
  assert.ok(!card.HISTORY_HEADING_RE.test('## Задача'));
  const stripped = card.withoutHistory(CARD);
  assert.ok(!stripped.includes('attempt') && stripped.includes('## Результат') && stripped.includes('## Задача'));
});

test('cardFiles: доска, затем done/; по умолчанию .md; свой фильтр', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-card-'));
  try {
    const board = card.boardDir(root);
    fs.mkdirSync(path.join(board, 'done'), { recursive: true });
    fs.writeFileSync(path.join(board, 'card-002-b.md'), '');
    fs.writeFileSync(path.join(board, 'notes.txt'), '');
    fs.writeFileSync(path.join(board, 'done', 'card-001-a.md'), '');
    assert.deepEqual(card.cardFiles(root).map((f) => path.basename(f)), ['card-002-b.md', 'card-001-a.md']);
    assert.deepEqual(card.cardFiles(root, /^card-001/).map((f) => path.basename(f)), ['card-001-a.md']);
    assert.deepEqual(card.cardFiles(root, (n) => n === 'notes.txt').map((f) => path.basename(f)), ['notes.txt']);
    assert.deepEqual(card.cardFiles(path.join(root, 'пусто')), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('ruleSince: дата из журнала; нет правила — завтра, и запись в журнал', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-rules-'));
  try {
    const log = path.join(root, '.forma', 'living', 'checks.json');
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.writeFileSync(log, JSON.stringify({ old: '2026-01-02' }));
    assert.equal(ruleSince(root, 'old'), '2026-01-02');
    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    assert.equal(ruleSince(root, 'fresh'), tomorrow);
    assert.deepEqual(JSON.parse(fs.readFileSync(log, 'utf8')), { old: '2026-01-02', fresh: tomorrow });
    assert.equal(ruleSince(root, 'fresh'), tomorrow, 'повторный вызов не сдвигает дату');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

const LINE = '- `Run`, 2026-05-04: attempt, 1 234 tokens (1 000 cache-read), 12 s, `0a1b2c3d4e5f` — claude-code: сделано.';

test('регулярки строки расхода: одна копия узнаёт каноническую строку', () => {
  assert.ok(S.CLAIM_LINE_RE.test(LINE));
  assert.ok(S.PARSES_RE.test(LINE));
  assert.ok(S.HAS_CALL_ID_RE.test(LINE));
  assert.ok(S.ENGINE_TAG_RE.test(LINE));
  const m = LINE.match(S.SPEND_TOKENS_RE);
  assert.deepEqual([m[1], m[2], m[3].replace(/\s/g, '')], ['Run', '2026-05-04', '1234']);
  assert.equal(LINE.match(S.CALL_ID_RE)[3], '0a1b2c3d4e5f');
  assert.equal(S.RU_CLAIM_LINE_RE.test('- `Kit`, 2026-01-01: заход, 5 токенов'), true);
  assert.equal(S.EN_CLAIM_LINE_RE.test('- `Kit`, 2026-01-01: attempt, 5 tokens'), true);
});

test('регулярки строки расхода: unknown — отдельный случай, а не число', () => {
  const unk = '- `Kit`, 2026-05-04: attempt, unknown tokens (cache-read unknown), 5 s, `id unknown` — claude-code: x.';
  assert.equal(S.SPEND_TOKENS_RE.test(unk), false);
  assert.equal(S.SPEND_TOKENS_OR_UNKNOWN_RE.test(unk), true);
  assert.equal(S.PARSES_RE.test(unk), true);
  assert.ok(S.CALL_ID_UNKNOWN_RE.test(unk));
  assert.ok(S.HAS_CALL_ID_RE.test(unk));
});

test('ATTEMPT_FORMAT_RE: глобальная, токены, кэш-чтение и секунды разом', () => {
  S.ATTEMPT_FORMAT_RE.lastIndex = 0;
  const m = S.ATTEMPT_FORMAT_RE.exec(LINE);
  assert.ok(m && m[4].includes('1 000') && m[5].includes('12'));
  S.ATTEMPT_FORMAT_RE.lastIndex = 0;
});
