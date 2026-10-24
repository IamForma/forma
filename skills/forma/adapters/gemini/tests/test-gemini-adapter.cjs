#!/usr/bin/env node
'use strict';

/**
 * test-gemini-adapter.cjs — Тест соответствия адаптера Gemini (Antigravity).
 * Проверяет:
 *  1. Наличие и валидность .agents/rules/gemini-8.md (наличие импорта @AGENTS.md, раздел §8, описание Plumb, тег gemini:);
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

function resolveAdapter() {
  const candidates = [
    path.resolve(__dirname, '../forma-adapter.cjs'),
    path.resolve(__dirname, '../../gemini/forma-adapter.cjs'),
    path.resolve(process.cwd(), '.agents/forma-adapter.cjs'),
    path.resolve(process.cwd(), '.forma/protocol/skills/forma/adapters/gemini/forma-adapter.cjs'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}
const adapter = require(resolveAdapter());

let passed = 0;
const it = (name, fn) => { fn(); passed += 1; console.log('ok  ' + name); };

// 1. Проверка gemini-8.md
it('.agents/rules/gemini-8.md существует и содержит регламент Plumb и правила движка', () => {
  assert.ok(fs.existsSync(gemini8Path), 'gemini-8.md должен существовать');
  const txt = fs.readFileSync(gemini8Path, 'utf8');
  assert.match(txt, /^@AGENTS\.md/m, 'должен быть импорт @AGENTS.md');
  assert.match(txt, /#\s*8\.\s*Engine architecture in Antigravity/, 'должен быть заголовок §8');
  assert.match(txt, /###\s*The Plumb/, 'должен быть раздел The Plumb');
  assert.match(txt, /gemini-3\.8-flash/, 'должна быть указана модель для встроенного Plumb');
  assert.match(txt, /plumb-scrub\.cjs/, 'должен быть указан скрипт очистки');
  assert.match(txt, /gemini:/, 'должен быть указан тег движка');
});

// 2. Паритет ролей
it('роли Gemini находятся в полном паритете с эталоном', () => {
  const results = parity.compareRoles(root, { only: 'gemini' });
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

// 3а. Платформенные роли и профили Gemini
it('plumb-gemini.md существует и содержит JSON-контракт измерения (choice, score, noul)', () => {
  const plumbPath = path.join(root, '.agents', 'plugins', 'forma', 'agents', 'plumb-gemini.md');
  assert.ok(fs.existsSync(plumbPath), 'plumb-gemini.md должен существовать');
  const txt = fs.readFileSync(plumbPath, 'utf8');
  assert.match(txt, /"choice":\s*\{\s*"role"/, 'должно быть поле choice');
  assert.match(txt, /"score":\s*\{\s*"clarity"/, 'должно быть поле score');
  assert.match(txt, /"noul":/, 'должно быть поле noul');
});

it('run-schema-markup.md существует в .agents/plugins/forma/agents/run/', () => {
  const schemaMarkupPath = path.join(root, '.agents', 'plugins', 'forma', 'agents', 'run', 'run-schema-markup.md');
  assert.ok(fs.existsSync(schemaMarkupPath), 'run-schema-markup.md должен существовать в .agents/plugins/forma/agents/run/');
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
    node: 'Plumb',
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
    assert.equal(t.byNode.Plumb.attempts, 1);
    assert.equal(t.byNode.Plumb.tokensUnknown, 1);
    assert.equal(t.byNode.Plumb.idUnknown, 1);
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

// 6. Расширенные поля адаптера дашборда
it('forma-adapter.cjs предоставляет transcriptsDir и parseUsage для стенограмм Antigravity', () => {
  assert.equal(typeof adapter.transcriptsDir, 'function');
  const tDir = adapter.transcriptsDir(root);
  assert.ok(tDir === null || typeof tDir === 'string');

  assert.equal(typeof adapter.parseUsage, 'function');
  const u1 = adapter.parseUsage({
    input_tokens: 1200,
    output_tokens: 300,
    cache_read_tokens: 450,
    cache_write_tokens: 100,
  });
  assert.deepEqual(u1, {
    tokens_in: 1200,
    tokens_out: 300,
    cache_read: 450,
    cache_write: 100,
  });

  const uEmpty = adapter.parseUsage(null);
  assert.deepEqual(uEmpty, {
    tokens_in: null,
    tokens_out: null,
    cache_read: null,
    cache_write: null,
  });
});

it('forma-adapter.cjs объявляет usageRefresh с выгрузкой в gemini-usage.json', () => {
  assert.ok(Array.isArray(adapter.usageRefresh));
  assert.equal(adapter.usageRefresh.length, 1);
  assert.equal(adapter.usageRefresh[0].cache, 'gemini-usage.json');
  assert.match(adapter.usageRefresh[0].script, /sync-ledger\.cjs/);
});

it('forma-adapter.cjs engineSettings возвращает структуру MCP, хуков и активных узлов', () => {
  assert.equal(typeof adapter.engineSettings, 'function');
  const settings = adapter.engineSettings(root);
  assert.equal(settings.present, true);
  assert.ok(Array.isArray(settings.hooks));
  if (fs.existsSync(path.join(root, '.agents', 'hooks.json'))) {
    assert.ok(settings.hooks.some((h) => h.name === 'forma-guard-delete'));
  }
  assert.ok(Array.isArray(settings.nodes));
  const nodeNames = settings.nodes.map((n) => n.name);
  for (const exp of ['intent', 'spec', 'kit', 'run', 'core']) {
    assert.ok(nodeNames.includes(exp), `узел ${exp} должен быть в списке узлов`);
  }
  assert.ok(settings.mcp && Array.isArray(settings.mcp.project));
});

it('forma-adapter.cjs предоставляет instructionWeight и stepsFromCacheRead для gemini-3.8-flash', () => {
  assert.equal(typeof adapter.instructionWeight, 'function');
  const iw = adapter.instructionWeight(root);
  assert.equal(iw.estimate, true);
  assert.equal(iw.model, 'gemini-3.8-flash');
  assert.ok(iw.common.tokens > 0);
  for (const n of ['Intent', 'Spec', 'Kit', 'Run', 'Core']) {
    assert.ok(iw.byNode[n], `узел ${n} должен присутствовать в byNode`);
    assert.ok(iw.byNode[n].perStep > iw.common.tokens);
    assert.equal(iw.byNode[n].model, 'gemini-3.8-flash');
  }

  assert.equal(typeof adapter.stepsFromCacheRead, 'function');
  assert.equal(adapter.stepsFromCacheRead(5000, 1000), 5);
  assert.equal(adapter.stepsFromCacheRead(null, 1000), null);
  assert.equal(adapter.stepsFromCacheRead(5000, 0), null);
});

console.log(`\nВсе ${passed} проверок адаптера Gemini пройдены успешно.`);
