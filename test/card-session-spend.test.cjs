// card-session-spend: расход основной сессии дописывается по карточке приращениями.
// Синтетический журнал сессии лежит в изолированном HOME (~/.claude/projects/<проект>/<сессия>.jsonl),
// синтетическая карточка — в проекте-фикстуре; реальных журналов и карточек тест не читает.
// «Полное чтение» — тот же журнал, прочитанный за один раз по другой карточке: эталон, с которым
// сверяется сумма приращений.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeFixture, runNode } = require('./helpers/fixture.cjs');
const { buildDataRaw } = require('./helpers/snapshot.cjs');

let fx;
let projDir;
test.before(() => {
  fx = makeFixture();
  // Скрипт берёт каталог журналов от своего пути (realpath главного модуля), как и Claude Code.
  projDir = path.join(fx.home, '.claude', 'projects', fs.realpathSync(fx.root).replace(/[^A-Za-z0-9]/g, '-'));
  fs.mkdirSync(projDir, { recursive: true });
});
test.after(() => { if (fx) fx.cleanup(); });

const SCRIPT = () => path.join(fx.root, '.claude', 'scripts', 'card-session-spend.cjs');
const features = () => path.join(fx.root, '.devtool', 'features');
const cardPath = (num) => path.join(features(), `card-${num}-test.md`);
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

// ---- журнал -------------------------------------------------------------------------------------
const iso = (hms) => `2026-09-29T${hms}.000Z`;
const human = (hms) => ({ type: 'user', timestamp: iso(hms), message: { role: 'user', content: 'продолжай' } });
const toolResult = (hms) => ({ type: 'user', timestamp: iso(hms),
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] } });
// u = [input, cache_write, cache_read, output]; tool — вызов инструмента в этой записи.
const answer = (hms, id, u, tool) => ({ type: 'assistant', timestamp: iso(hms), message: {
  id, role: 'assistant',
  usage: { input_tokens: u[0], cache_creation_input_tokens: u[1], cache_read_input_tokens: u[2], output_tokens: u[3] },
  content: [tool ? { type: 'tool_use', name: tool.name, input: tool.input } : { type: 'text', text: 'ok' }] } });
const editCard = (num) => ({ name: 'Edit', input: { file_path: path.join(features(), `card-${num}-test.md`) } });
const readOther = { name: 'Read', input: { file_path: 'x.md' } };

// Первый заход: три ответа карточки (m1, m2 — одним ответом в двух записях, m3), событие записи — m2 и m3.
const stage1 = (n) => [
  human('10:00:00'),
  answer('10:00:10', 'm1', [10, 100, 1000, 50]),
  answer('10:00:30', 'm2', [20, 200, 2000, 60], editCard(n)),
  answer('10:00:30', 'm2', [20, 200, 2000, 60], readOther), // тот же message.id — считается один раз
  toolResult('10:00:35'),
  human('10:10:00'),
  answer('10:10:20', 'm3', [30, 300, 3000, 70], editCard(n)),
];
// Новые ответы: m4 — сразу за границей первого захода (якорь: 30 с промежутка идут в новую строку),
// m5 — событие чужой карточки, m6 — снова карточки после чужого (отрезок с реплики человека).
const stage2 = (n) => [
  answer('10:10:50', 'm4', [40, 400, 4000, 80], editCard(n)),
  human('10:20:00'),
  answer('10:20:05', 'm5', [50, 500, 5000, 90], editCard('999')),
  human('10:30:00'),
  answer('10:30:15', 'm6', [60, 600, 6000, 100], editCard(n)),
];
// Разговор без записи в карточку — никому не отходит.
const noise = () => [human('10:40:00'), answer('10:40:10', 'm7', [1, 1, 1, 1])];

// Числа, которые получаются по устройству журнала (руками, не из скрипта):
//   первый заход  m1+m2+m3: N = 1160+2280+3400, R = 1000+2000+3000, T = 10+20+0+5+300(обрезано --idle)+20
//   приращение    m4+m6:    N = 4520+6760,      R = 4000+6000,      T = 30 (якорь) + 15
const FIRST = { N: 6840, R: 6000, T: 355 };
const NEXT = { N: 11280, R: 10000, T: 45 };
const FULL = { N: 18120, R: 16000, T: 400 };

// ---- запуск и разбор ---------------------------------------------------------------------------
function writeCard(num, historyLines = []) {
  fs.writeFileSync(cardPath(num), [
    '---', `id: "card-${num}-test"`, 'status: "review"', 'assignee: "Intent"', 'labels: ["goal-forma", "route-4"]', '---',
    `# card-${num} · тест`, '', '## Задача', `${num} · оснастка | тест | критерий | 2 | человеку`, '',
    '## Снаряжение', '', '## История', ...historyLines, '', '## Результат', ''].join('\n'));
}
const putSession = (sid, rows) => fs.writeFileSync(path.join(projDir, `${sid}.jsonl`), jsonl(rows));
const run = (num, sid, ...extra) => runNode(fx, [SCRIPT(), num, '--session', sid, ...extra]);
const cardText = (num) => fs.readFileSync(cardPath(num), 'utf8');

// N, R, T строк расхода этой сессии из текста (карточки или вывода).
function spendOf(text, sid) {
  const re = /attempt,\s*([\d ]+) tokens \(([\d ]+) cache-read\), (\d+) s, `([^`]+)` — [^\n]*/g;
  const out = [];
  for (const m of text.matchAll(re)) {
    if (m[4] === sid) out.push({ N: Number(m[1].replace(/ /g, '')), R: Number(m[2].replace(/ /g, '')), T: Number(m[3]), line: m[0] });
  }
  return out;
}
const sum = (list) => list.reduce((a, x) => ({ N: a.N + x.N, R: a.R + x.R, T: a.T + x.T }), { N: 0, R: 0, T: 0 });
const nums = (x) => ({ N: x.N, R: x.R, T: x.T });

// Полное чтение журнала: те же записи, но для карточки `n` (печать, без записи в карточку).
function fullRead(n, sid, rows) {
  writeCard(n);
  putSession(sid, rows);
  const r = run(n, sid);
  assert.equal(r.status, 0, r.stderr);
  const [one, ...rest] = spendOf(r.stdout, sid);
  assert.equal(rest.length, 0);
  return nums(one);
}

test('полное чтение журнала даёт ожидаемые числа (эталон теста)', () => {
  const full = fullRead('910', 's-full-910', [...stage1('910'), ...stage2('910'), ...noise()]);
  assert.deepEqual(full, FULL);
});

test('два --write с новыми ответами между ними: сумма строк сессии равна однократному полному чтению', () => {
  const n = '901', sid = 's-two-writes-901';
  writeCard(n);
  putSession(sid, stage1(n));
  let r = run(n, sid, '--write');
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(spendOf(cardText(n), sid).map(nums), [FIRST]);

  putSession(sid, [...stage1(n), ...stage2(n), ...noise()]);
  r = run(n, sid, '--write');
  assert.equal(r.status, 0, r.stderr);
  const lines = spendOf(cardText(n), sid);
  assert.equal(lines.length, 2, 'вторая запись — отдельная строка приращения');
  assert.deepEqual(nums(lines[1]), NEXT, 'вторая строка — только новые ответы, не накопительная сумма');
  assert.deepEqual(sum(lines), fullRead('911', 's-full-911', [...stage1('911'), ...stage2('911'), ...noise()]));
  assert.deepEqual(sum(lines), FULL);
});

test('повторный запуск без новых ответов ничего не пишет', () => {
  const n = '902', sid = 's-no-new-902';
  writeCard(n);
  putSession(sid, [...stage1(n), ...stage2(n)]);
  assert.equal(run(n, sid, '--write').status, 0);
  const before = cardText(n);
  // Ни повтор, ни разговор без записи в карточку (новые ответы, которые никому не отходят) строк не добавляют.
  putSession(sid, [...stage1(n), ...stage2(n), ...noise()]);
  for (const args of [['--write'], ['--write'], []]) {
    const r = run(n, sid, ...args);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /нового расхода нет/);
    assert.doesNotMatch(r.stdout, /attempt,/);
  }
  assert.equal(cardText(n), before, 'карточка не изменилась');
  assert.equal(spendOf(before, sid).length, 1);
});

test('печать без --write при уже записанных строках показывает только неучтённый остаток', () => {
  const n = '903', sid = 's-print-903';
  writeCard(n);
  putSession(sid, stage1(n));
  assert.equal(run(n, sid, '--write').status, 0);
  putSession(sid, [...stage1(n), ...stage2(n)]);
  const r = run(n, sid);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(spendOf(r.stdout, sid).map(nums), [NEXT]);
  assert.equal(spendOf(cardText(n), sid).length, 1, 'печать карточку не трогает');
});

test('--from/--to: окно задано вручную, результат как прежде, «уже учтено» не применяется', () => {
  const n = '904', sid = 's-manual-904';
  writeCard(n);
  putSession(sid, [...stage1(n), ...stage2(n)]);
  assert.equal(run(n, sid, '--write').status, 0); // карточка уже несёт строки сессии
  const r = run(n, sid, '--from', '2026-09-29T10:00:00Z', '--to', '2026-09-29T10:10:30Z');
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(spendOf(r.stdout, sid).map(nums), [FIRST]);
  // Окно в одну запись (m4): только её расход, время — 0.
  const one = run(n, sid, '--from', '2026-09-29T10:10:40Z', '--to', '2026-09-29T10:10:55Z');
  assert.deepEqual(spendOf(one.stdout, sid).map(nums), [{ N: 4520, R: 4000, T: 0 }]);
});

test('строка ручного окна помечена и границу «уже учтено» не двигает', () => {
  const n = '905', sid = 's-manual-mark-905';
  writeCard(n);
  putSession(sid, [...stage1(n), ...stage2(n)]);
  const manual = run(n, sid, '--from', '2026-09-29T10:00:00Z', '--to', '2026-09-29T10:10:30Z', '--write');
  assert.equal(manual.status, 0, manual.stderr);
  const [line] = spendOf(cardText(n), sid);
  assert.match(line.line, /задано --from\/--to/);
  assert.doesNotMatch(line.line, /граница/);
  // Автоматический запуск считает всё с начала: ручная строка границу не задала.
  assert.deepEqual(spendOf(run(n, sid).stdout, sid).map(nums), [FULL]);
});

test('строка старого вида (накопительная, без метки границы): граница — конец минуты конца окна', () => {
  const n = '906', sid = 's-legacy-906';
  const legacy = '- `Intent`, 2026-09-29: attempt, 6 840 tokens (6 000 cache-read), 355 s, `' + sid + '` — claude-code: ' +
    'расход основной сессии по журналу (card-session-spend): 3 ответов, окно 10:00–10:10 UTC, выход 180, запись в кеш 600.';
  // Новый ответ — на 10:20, дальше конца минуты 10:10.
  const tail = [human('10:20:00'), answer('10:20:05', 'm8', [40, 400, 4000, 80], editCard(n))];
  writeCard(n, [legacy]);
  putSession(sid, [...stage1(n), ...tail]);
  const r = run(n, sid, '--write');
  assert.equal(r.status, 0, r.stderr);
  const lines = spendOf(cardText(n), sid);
  assert.equal(lines.length, 2);
  assert.deepEqual(nums(lines[1]), { N: 4520, R: 4000, T: 300 + 5 });
  assert.deepEqual(sum(lines), fullRead('912', 's-full-912', [...stage1('912'), ...[human('10:20:00'), answer('10:20:05', 'm8', [40, 400, 4000, 80], editCard('912'))]]));
});

// ---- счётчик: приращения одной сессии считаются все, накопительные дубли — по-прежнему один раз ----
function tallyTotal(num, historyLines) {
  writeCard(num, historyLines);
  const r = runNode(fx, [path.join(fx.root, '.forma', 'dashboard', 'tally.cjs'), cardPath(num)]);
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout).total;
}
const spendRow = (n, r, t, tail) => '- `Intent`, 2026-09-29: attempt, ' + n + ' tokens (' + r + ' cache-read), ' + t + ' s, `s-tally` — claude-code: ' +
  'расход основной сессии по журналу (card-session-spend): 2 ответов' + tail;

test('tally: строки с разной границей — приращения, суммируются; без метки — накопительные, считаются один раз', () => {
  const marked = tallyTotal('907', [
    spendRow(1000, 500, 10, ', граница 2026-09-29T10:10:20.000Z.'),
    spendRow(2000, 800, 20, ', граница 2026-09-29T10:30:15.000Z.'),
    spendRow(2000, 800, 20, ', граница 2026-09-29T10:30:15.000Z.'), // та же граница — дубль, не приращение
  ]);
  assert.equal(marked.tokens, 3000);
  assert.equal(marked.seconds, 30);
  const legacy = tallyTotal('908', [spendRow(1000, 500, 10, '.'), spendRow(2000, 800, 20, '.')]);
  assert.equal(legacy.tokens, 1000, 'старые накопительные строки схлопываются в первую, как прежде');
});

test('tally: общий id вызова с разными числами — разные заходы, с теми же числами — дубль', () => {
  const row = (n, r, t) => '- `Intent`, 2026-09-29: attempt, ' + n + ' tokens (' + r + ' cache-read), ' + t + ' s, `s-shared` — claude-code: сборка секции.';
  const shared = tallyTotal('909', [row(1000, 500, 10), row(2000, 800, 20), row(2000, 800, 20)]);
  assert.equal(shared.tokens, 3000, 'две разные записи под одним id считаются обе, точная копия — один раз');
});

// ---- дашборд: buildData (dashboard/data/cards.cjs) — тот же ключ, что в tally ----
// Карточка `num` в собранных данных: объект с путём карточки и её заходами.
function boardCard(num) {
  const found = [];
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      if (typeof v.path === 'string' && v.path.includes(`card-${num}-test.md`) && Array.isArray(v.attempts)) found.push(v);
      Object.values(v).forEach(walk);
    }
  };
  walk(buildDataRaw(fx));
  assert.ok(found.length >= 1, 'карточка не попала в данные дашборда');
  return found[0];
}

test('buildData: строки одной сессии с разной границей — приращения, учитываются обе; без метки — одна, как раньше', () => {
  writeCard('920', [
    spendRow(1000, 500, 10, ', граница 2026-09-29T10:10:20.000Z.'),
    spendRow(2000, 800, 20, ', граница 2026-09-29T10:30:15.000Z.'),
    spendRow(2000, 800, 20, ', граница 2026-09-29T10:30:15.000Z.'), // та же граница — дубль
  ]);
  const marked = boardCard('920');
  assert.equal(marked.attempts.length, 2);
  assert.equal(marked.tokensByEngine['claude-code'].tokens, 3000);
  writeCard('921', [spendRow(1000, 500, 10, '.'), spendRow(2000, 800, 20, '.')]);
  const legacy = boardCard('921');
  assert.equal(legacy.attempts.length, 1, 'старые накопительные строки схлопываются в первую');
  assert.equal(legacy.tokensByEngine['claude-code'].tokens, 1000);
  assert.equal('windowEnd' in legacy.attempts[0], false, 'запись без метки не получает нового поля');
});

// ---- касания карточки: коммит через forma-commit и правка файла карточки из Bash/PowerShell -----------
const bash = (command) => ({ name: 'Bash', input: { command } });
const powershell = (command) => ({ name: 'PowerShell', input: { command } });

// Шесть ответов, каждый — в отрезке одной карточки: a1+a2 → 006 (коммит через forma-commit),
// b1+b2 → 007 (sed -i по файлу карточки), c1 → 008 (Add-Content), d1 → 006 (шаблон card-006-*.md).
// Чтение файла карточки (cat) касанием не считается: касаний нет.
// N ответа = сумма его четырёх счётчиков: a1 116, a2 228, b1 340, b2 452, c1 564, d1 676; всего 2376.
const touches = () => [
  human('11:00:00'),
  answer('11:00:10', 'a1', [1, 10, 100, 5], bash('cat .devtool/features/card-009-test.md')),
  answer('11:00:20', 'a2', [2, 20, 200, 6], bash('node protocol/scripts/forma-commit.cjs "' + 'Карточка ' + '006: тест"')),
  human('11:10:00'),
  answer('11:10:10', 'b1', [3, 30, 300, 7]),
  answer('11:10:20', 'b2', [4, 40, 400, 8], bash("sed -i 's/a/b/' .devtool/features/card-007-test.md")),
  human('11:20:00'),
  answer('11:20:10', 'c1', [5, 50, 500, 9], powershell('Add-Content .devtool\\features\\card-008-test.md "строка"')),
  human('11:30:00'),
  answer('11:30:10', 'd1', [6, 60, 600, 10], bash('cat >> .devtool/features/card-006-*.md <<EOF\nстрока\nEOF')),
];

test('касания: коммит через forma-commit и запись из Bash/PowerShell; ответ — ровно одной карточке, сумма равна полному чтению', () => {
  const sid = 's-touches-006';
  putSession(sid, touches());
  const nOf = (n) => {
    writeCard(n);
    const r = run(n, sid);
    assert.equal(r.status, 0, `card-${n}: ${r.stderr}`);
    const [one, ...rest] = spendOf(r.stdout, sid);
    assert.equal(rest.length, 0);
    return one.N;
  };
  const byCard = { 006: nOf('006'), 007: nOf('007'), 008: nOf('008') };
  assert.deepEqual(byCard, { 006: 116 + 228 + 676, 007: 340 + 452, 008: 564 });
  writeCard('944');
  const full = run('944', sid, '--from', '2026-09-29T00:00:00Z', '--to', '2026-09-29T23:59:59Z');
  assert.equal(spendOf(full.stdout, sid)[0].N, 2376);
  assert.equal(byCard[006] + byCard[007] + byCard[008], 2376, 'окна карточек не пересекаются и покрывают журнал');
});

test('касания: чтение файла карточки из Bash касанием не считается', () => {
  const sid = 's-touches-009';
  putSession(sid, touches());
  writeCard('009');
  const r = run('009', sid);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /касаний не найдено/);
});
