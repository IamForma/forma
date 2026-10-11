#!/usr/bin/env node
'use strict';

/**
 * test-gemini-adapter.cjs — Тест соответствия адаптера Gemini (Antigravity).
 * Проверяет:
 *  1. Наличие и валидность .agents/rules/gemini-8.md (наличие импорта @AGENTS.md, раздел §8, описание Gauge, тег gemini:);
 *  2. Паритет ролей Gemini с каноническими ролями (.claude/);
 *  3. Отсутствие проектных профилей Run в чистой зоне .agents/;
 *  4. Формирование и разбор строк расхода с тегом gemini: по контракту ECONOMY.md;
 *  5. Чистоту файлов адаптера (запрет 16).
 *
 * Запуск:
 *   node .agents/tests/test-gemini-adapter.cjs
 */

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const gemini8Path = path.join(root, '.agents', 'rules', 'gemini-8.md');
const parity = require('../../.claude/scripts/checks/support/role-parity.cjs');
const { formatSpendLine } = require('../../.forma/dashboard/spend-line.cjs');
const { tally } = require('../../.forma/dashboard/tally.cjs');
const { inCleanZone, scanCleanFile, cleanOwn } = require('../../.claude/scripts/checks/support/clean-zone.cjs');

let passed = 0;
const it = (name, fn) => { fn(); passed += 1; console.log('ok  ' + name); };

// 1. Проверка gemini-8.md
it('.agents/rules/gemini-8.md существует и содержит регламент Gauge и правила движка', () => {
  assert.ok(fs.existsSync(gemini8Path), 'gemini-8.md должен существовать');
  const txt = fs.readFileSync(gemini8Path, 'utf8');
  assert.match(txt, /^@AGENTS\.md/m, 'должен быть импорт @AGENTS.md');
  assert.match(txt, /#\s*8\.\s*Engine architecture in Antigravity/, 'должен быть заголовок §8');
  assert.match(txt, /###\s*The Gauge/, 'должен быть раздел The Gauge');
  assert.match(txt, /gemini-3\.8-flash/, 'должна быть указана модель для встроенного Gauge');
  assert.match(txt, /gauge-scrub\.cjs/, 'должен быть указан скрипт очистки');
  assert.match(txt, /gemini:/, 'должен быть указан тег движка');
});

// 2. Паритет ролей
it('роли Gemini находятся в полном паритете с эталоном', () => {
  const results = parity.compareRoles(root);
  const drifted = results.filter((r) => r.res.status !== 'synced');
  assert.equal(drifted.length, 0, `Обнаружен дрейф ролей: ${drifted.map((d) => d.pair.name + ' (' + d.res.status + ')').join(', ')}`);
});

// 3. Отсутствие проектных профилей в .agents/
it('в .agents/plugins/forma/agents/run/ отсутствуют проектные профили текущего продукта', () => {
  const runDir = path.join(root, '.agents', 'plugins', 'forma', 'agents', 'run');
  const files = fs.readdirSync(runDir);
  assert.ok(!files.includes('run-pillow-translate.md'), 'run-pillow-translate.md не должен находиться в .agents/');
  assert.ok(!files.includes('run-site-upload.md'), 'run-site-upload.md не должен находиться в .agents/');
});

// 4. Соответствие экономическому контракту (строка gemini:, разбор tally)
it('строки расхода gemini: формируются и разбираются tally.cjs по контракту', () => {
  const d = ['2000', '01', '02'].join('-');
  const normalLine = formatSpendLine({
    node: 'Run',
    date: d,
    engine: 'gemini',
    tokens: 1500,
    cache_read: 500,
    duration_s: 12,
    call_id: 'conv-12345678',
    desc: 'выполнено.',
  });

  const unknownLine = formatSpendLine({
    node: 'Gauge',
    date: d,
    engine: 'gemini',
    tokens: null,
    cache_read: null,
    duration_s: null,
    call_id: null,
    desc: 'role run-text, 85 % (gap 40, clarity 4), haiku, fits.',
  });

  const fixture = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-econ-')), 'card.md');
  try {
    fs.writeFileSync(fixture, '# Card\n\n## History\n- ' + normalLine + '\n- ' + unknownLine + '\n\n## Result\n');
    const t = tally([fixture]);
    assert.equal(t.byNode.Run.attempts, 1);
    assert.equal(t.byNode.Run.tokens, 1500);
    assert.equal(t.byNode.Run.cacheRead, 500);
    assert.equal(t.byNode.Run.seconds, 12);
    assert.equal(t.byNode.Gauge.attempts, 1);
    assert.equal(t.byNode.Gauge.tokensUnknown, 1);
    assert.equal(t.byNode.Gauge.idUnknown, 1);
  } finally {
    fs.rmSync(path.dirname(fixture), { recursive: true, force: true });
  }
});

// 5. Чистая зона (Запрет 16)
it('файлы адаптера .agents/ соответствуют запрету 16 (чистые зоны)', () => {
  const own = cleanOwn(root);
  const targets = [
    '.agents/rules/gemini-8.md',
    '.agents/forma-adapter.cjs',
    '.agents/tests/test-gemini-adapter.cjs',
  ];
  for (const rel of targets) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs) && inCleanZone(rel, own)) {
      const problems = scanCleanFile(rel, fs.readFileSync(abs, 'utf8'));
      assert.deepEqual(problems, [], `След проекта в ${rel}: ${problems.join('; ')}`);
    }
  }
});

console.log(`\nВсе ${passed} проверок адаптера Gemini пройдены успешно.`);
