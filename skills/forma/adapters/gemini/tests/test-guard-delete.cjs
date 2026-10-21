#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  isProtectedPath,
  checkCommand,
  unlockDeletion,
  consumeUnlock,
  isUnlockActive,
  runGuard,
} = require('../../.forma/rules/guard-delete.cjs');

let passed = 0;
const it = (name, fn) => {
  fn();
  passed++;
  console.log('ok  ' + name);
};

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-test-'));

try {
  // 1. Проверка защищенных путей
  it('корректно определяет защищенные файлы и каталоги', () => {
    assert.equal(isProtectedPath('.claude', tmpDir), true);
    assert.equal(isProtectedPath('.agents/rules/gemini-8.md', tmpDir), true);
    assert.equal(isProtectedPath('.codex', tmpDir), true);
    assert.equal(isProtectedPath('.devtool/features', tmpDir), true);
    assert.equal(isProtectedPath('.forma/manual', tmpDir), true);
    assert.equal(isProtectedPath('AGENTS.md', tmpDir), true);
    assert.equal(isProtectedPath('PROJECT.md', tmpDir), true);
    assert.equal(isProtectedPath('project/goals/goal-01/GOAL.md', tmpDir), true);
    assert.equal(isProtectedPath('VARS/credentials.md', tmpDir), true);

    // Обычные файлы не должны блокироваться
    assert.equal(isProtectedPath('src/index.js', tmpDir), false);
    assert.equal(isProtectedPath('assets/image.png', tmpDir), false);
    assert.equal(isProtectedPath('package.json', tmpDir), false);
  });

  // 2. Блокировка команд удаления
  it('блокирует команды удаления защищенных файлов (POSIX и Windows)', () => {
    // POSIX
    let res = checkCommand('rm -rf .agents', tmpDir);
    assert.equal(res.blocked, true);

    res = checkCommand('rm AGENTS.md', tmpDir);
    assert.equal(res.blocked, true);

    // PowerShell / Windows
    res = checkCommand('Remove-Item -Recurse -Force .claude', tmpDir);
    assert.equal(res.blocked, true);

    res = checkCommand('del /f /q PROJECT.md', tmpDir);
    assert.equal(res.blocked, true);

    // Не деструктивные команды разрешены
    res = checkCommand('cat AGENTS.md', tmpDir);
    assert.equal(res.blocked, false);

    res = checkCommand('git status', tmpDir);
    assert.equal(res.blocked, false);

    // Удаление обычного файла разрешено
    res = checkCommand('rm scratch.txt', tmpDir);
    assert.equal(res.blocked, false);
  });

  // 3. Одноразовая разблокировка («Отключи сенсорику»)
  it('фраза «Отключи сенсорику» снимает блокировку строго на одно действие', () => {
    // Без разблокировки - блокируется
    let res = checkCommand('rm -rf .devtool', tmpDir);
    assert.equal(res.blocked, true);

    // Активируем разблокировку
    unlockDeletion(tmpDir);
    assert.equal(isUnlockActive(tmpDir), true);

    // Первое удаление проходит и снимает маркер
    res = checkCommand('rm -rf .devtool', tmpDir);
    assert.equal(res.blocked, false);
    assert.equal(res.unblockedByPhrase, true);
    assert.equal(isUnlockActive(tmpDir), false);

    // Второе удаление немедленно снова блокируется
    res = checkCommand('rm -rf .devtool', tmpDir);
    assert.equal(res.blocked, true);
  });

  // 4. Проверка интерфейса PreToolUse
  it('runGuard возвращает корректный decision для Antigravity', () => {
    let out = runGuard({
      toolName: 'run_command',
      args: { CommandLine: 'rm -rf .forma' },
      root: tmpDir,
    });
    assert.equal(out.decision, 'deny');
    assert.match(out.reason, /Запрет 1/);

    out = runGuard({
      toolName: 'run_command',
      args: { CommandLine: 'npm test' },
      root: tmpDir,
    });
    assert.equal(out.decision, 'allow');
  });

  console.log(`\nВсе ${passed} проверок guard-delete успешно пройдены.`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
