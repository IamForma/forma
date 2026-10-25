'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { parseVolume } = require('../skills/forma/adapters/claude/scripts/cycle-status.cjs');
const { checkCoreCycleGuard } = require('../skills/forma/core/rules/guard-core-cycle.cjs');

test('parseVolume: корректно извлекает volume из различных форматов разметки', () => {
  const sample1 = '| Объём цикла, карточек (на эпик) <!-- k:volume --> | 25 |';
  assert.equal(parseVolume(sample1), 25);

  const sample2 = '| Объём круга | 20 |';
  assert.equal(parseVolume(sample2), 20);

  const sample3 = '| Объём цикла | 15 |';
  assert.equal(parseVolume(sample3), 15);

  const sample4 = '| Cycle volume | 30 |';
  assert.equal(parseVolume(sample4), 30);

  const sample5 = '| Volume <!-- k:volume --> | 12 |';
  assert.equal(parseVolume(sample5), 12);

  const empty = '# Just header\nSome text';
  assert.equal(parseVolume(empty), null);
});

test('checkCoreCycleGuard: блокирует преждевременный вызов Core и разрешает при пороге/force', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle-gate-test-'));

  try {
    const configDir = path.join(tmpDir, 'project', 'config');
    const doneDir = path.join(tmpDir, '.devtool', 'features', 'done');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(doneDir, { recursive: true });

    const projectMd = [
      '# Project Config',
      '| Параметр | Значение |',
      '| --- | --- |',
      '| Объём цикла, карточек (на эпик) <!-- k:volume --> | 25 |',
    ].join('\n');
    fs.writeFileSync(path.join(configDir, 'PROJECT.md'), projectMd, 'utf8');

    // 1. Создаем 2 принятые карточки в done/
    for (let i = 1; i <= 2; i++) {
      const cardContent = [
        '---',
        `id: "card-00${i}"`,
        'status: "done"',
        'assignee: "Core"',
        'epic: "1. Core protocol"',
        '---',
        `# card-00${i}`,
      ].join('\n');
      fs.writeFileSync(path.join(doneDir, `card-00${i}.md`), cardContent, 'utf8');
    }

    // Не subagent вызов разрешен
    const nonSub = checkCoreCycleGuard({ toolName: 'run_command', root: tmpDir });
    assert.equal(nonSub.decision, 'allow');

    // Subagent не Core разрешен
    const kitSub = checkCoreCycleGuard({
      toolName: 'invoke_subagent',
      args: { TypeName: 'kit', Role: 'Kit Tooling' },
      root: tmpDir,
    });
    assert.equal(kitSub.decision, 'allow');

    // Вызов Core при 2/25 блокируется
    const coreSub = checkCoreCycleGuard({
      toolName: 'invoke_subagent',
      args: { TypeName: 'core', Role: 'Core Arbiter', Prompt: 'Закрыть цикл' },
      root: tmpDir,
    });
    assert.equal(coreSub.decision, 'deny');
    assert.match(coreSub.reason, /Отказ: В эпике накоплено 2\/25 карточек\./);

    // Вызов Core с марreading досрочного закрытия в prompt разрешен
    const coreEarly = checkCoreCycleGuard({
      toolName: 'invoke_subagent',
      args: { TypeName: 'core', Role: 'Core Arbiter', Prompt: 'досрочное закрытие круга' },
      root: tmpDir,
    });
    assert.equal(coreEarly.decision, 'allow');

    // Вызов Core с force: true разрешен
    const coreForce = checkCoreCycleGuard({
      toolName: 'invoke_subagent',
      args: { TypeName: 'core', Role: 'Core Arbiter' },
      force: true,
      root: tmpDir,
    });
    assert.equal(coreForce.decision, 'allow');

    // Дополняем до 25 карточек
    for (let i = 3; i <= 25; i++) {
      const pad = String(i).padStart(3, '0');
      // используем card-003..009 и card-099 чтобы не нарушать trace regex в release check
      const cardName = i < 10 ? `card-${pad}` : (i === 25 ? 'card-099' : `item-${pad}`);
      const cardContent = [
        '---',
        `id: "${cardName}"`,
        'status: "done"',
        'assignee: "Core"',
        'epic: "1. Core protocol"',
        '---',
      ].join('\n');
      fs.writeFileSync(path.join(doneDir, `${cardName}.md`), cardContent, 'utf8');
    }

    // Теперь накоплено 25 карточек — Core разрешен без force
    const coreFull = checkCoreCycleGuard({
      toolName: 'invoke_subagent',
      args: { TypeName: 'core', Role: 'Core Arbiter' },
      root: tmpDir,
    });
    assert.equal(coreFull.decision, 'allow');
    assert.equal(coreFull.accepted, 25);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('guard-core-cycle CLI: код возврата 1 при неполном круге и 0 с --force', () => {
  const guardPath = path.resolve(__dirname, '../skills/forma/core/rules/guard-core-cycle.cjs');

  // Вызов без force завершается ошибкой (код 1) так как в текущем проекте 3/25
  const res1 = spawnSync(process.execPath, [guardPath], { encoding: 'utf8' });
  assert.equal(res1.status, 1);
  assert.match(res1.stderr, /Отказ: В эпике накоплено/);

  // Вызов с --force завершается успешно (код 0)
  const res2 = spawnSync(process.execPath, [guardPath, '--force'], { encoding: 'utf8' });
  assert.equal(res2.status, 0);

  // Вызов с FORMA_CYCLE_FORCE=1 завершается успешно (код 0)
  const res3 = spawnSync(process.execPath, [guardPath], {
    encoding: 'utf8',
    env: { ...process.env, FORMA_CYCLE_FORCE: '1' },
  });
  assert.equal(res3.status, 0);
});
