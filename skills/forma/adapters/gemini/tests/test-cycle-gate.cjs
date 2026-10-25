'use strict';

/**
 * test-cycle-gate.cjs — тест гейта накопления цикла Core и парсинга k:volume для адаптера Gemini.
 */

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function resolveRoot() {
  const candidates = [
    path.resolve(__dirname, '../..'),                   // in project: .agents/tests -> project root
    path.resolve(__dirname, '../../../../../../..'),     // in protocol clone inside project
    path.resolve(__dirname, '../../../../..'),           // in standalone protocol repo
  ];
  for (const c of candidates) {
    if (
      fs.existsSync(path.join(c, 'project', 'config', 'PROJECT.md')) ||
      fs.existsSync(path.join(c, '.claude', 'scripts', 'cycle-status.cjs'))
    ) {
      return c;
    }
  }
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'skills', 'forma'))) return c;
  }
  return candidates[0];
}

const root = resolveRoot();
function resolveCycleStatus() {
  const candidates = [
    path.join(root, '.claude', 'scripts', 'cycle-status.cjs'),
    path.resolve(__dirname, '../../.claude/scripts/cycle-status.cjs'),
    path.resolve(__dirname, '../../../adapters/claude/scripts/cycle-status.cjs'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return candidates[0];
}

function resolveGuardCoreCycle() {
  const candidates = [
    path.join(root, '.forma', 'rules', 'guard-core-cycle.cjs'),
    path.resolve(__dirname, '../../.forma/rules/guard-core-cycle.cjs'),
    path.resolve(__dirname, '../../../core/rules/guard-core-cycle.cjs'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return candidates[0];
}

const { parseVolume } = require(resolveCycleStatus());
const { checkCoreCycleGuard } = require(resolveGuardCoreCycle());

let passed = 0;
const it = (name, fn) => { fn(); passed += 1; console.log('ok  ' + name); };

it('parseVolume парсит якорь k:volume и варианты названий объема', () => {
  assert.equal(parseVolume('| Объём цикла, карточек (на эпик) <!-- k:volume --> | 25 |'), 25);
  assert.equal(parseVolume('| Объём круга | 25 |'), 25);
  assert.equal(parseVolume('| Cycle volume | 25 |'), 25);
});

it('checkCoreCycleGuard блокирует invoke_subagent Core при N < 25', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-cycle-gate-'));
  try {
    const configDir = path.join(tmpDir, 'project', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'PROJECT.md'), '| <!-- k:volume --> | 25 |', 'utf8');

    const denied = checkCoreCycleGuard({
      toolName: 'invoke_subagent',
      args: { TypeName: 'core', Role: 'Core Arbiter' },
      root: tmpDir,
    });
    assert.equal(denied.decision, 'deny');
    assert.match(denied.reason, /Отказ: В эпике накоплено 0\/25 карточек\./);

    const forced = checkCoreCycleGuard({
      toolName: 'invoke_subagent',
      args: { TypeName: 'core', Role: 'Core Arbiter' },
      force: true,
      root: tmpDir,
    });
    assert.equal(forced.decision, 'allow');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

it('PreToolUse hook guard-core-cycle.cjs отвечает JSON-контрактом deny/allow', () => {
  const candidates = [
    path.join(root, '.agents', 'hooks', 'guard-core-cycle.cjs'),
    path.resolve(__dirname, '../hooks/guard-core-cycle.cjs'),
  ];
  const hookScript = candidates.find((c) => fs.existsSync(c));
  assert.ok(hookScript, 'скрипт хука должен существовать');

  const payloadDeny = JSON.stringify({
    toolCall: {
      name: 'invoke_subagent',
      args: { TypeName: 'core' },
    },
    workspacePaths: [root],
  });

  const resDeny = spawnSync(process.execPath, [hookScript], { input: payloadDeny, encoding: 'utf8' });
  assert.equal(resDeny.status, 0);
  const outDeny = JSON.parse(resDeny.stdout);
  assert.equal(outDeny.decision, 'deny');
  assert.match(outDeny.reason, /Отказ: В эпике накоплено \d+\/25 карточек\./);

  const payloadForce = JSON.stringify({
    toolCall: {
      name: 'invoke_subagent',
      args: { TypeName: 'core', Prompt: 'досрочное закрытие --force' },
    },
    workspacePaths: [root],
  });

  const resForce = spawnSync(process.execPath, [hookScript], { input: payloadForce, encoding: 'utf8' });
  assert.equal(resForce.status, 0);
  const outForce = JSON.parse(resForce.stdout);
  assert.equal(outForce.decision, 'allow');
});

console.log(`\nВсе ${passed} проверок cycle-gate успешно пройдены.`);
