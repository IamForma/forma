'use strict';

/**
 * Профиль проверки установки движка MiniMax Code.
 *
 * Ядро находит этот файл по манифесту (`engines[].profile`) и зовёт `check(ctx)`;
 * ожидания берутся из манифеста (`engine.expect`), а не из кода: установщик записал,
 * что ставил, — профиль сверяет это с диском.
 *
 * Пока движок не зарегистрирован в манифесте, профиль не вызывается ядром; он
 * запускается вручную и тестом зоны. Всё, что он проверяет, — из зоны `.minimax/`.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ZONE = '.minimax';

/** Роли узлов, которые должны быть на месте. */
const NODES = ['intent', 'spec', 'kit', 'core'];

/** Файлы зоны, без которых движок не считается установленным. */
const REQUIRED = [
  '.minimax/forma-adapter.cjs',
  '.minimax/rules/minimax-8.md',
  '.minimax/scripts/gen-roles.cjs',
  '.minimax/scripts/sync-ledger.cjs',
  '.minimax/scripts/capabilities.cjs',
  '.minimax/scripts/economy.cjs',
  '.minimax/scripts/tool-usage.cjs',
  '.minimax/verify-profile.cjs',
  '.minimax/tests/test-minimax-adapter.cjs',
];

function checkFiles(ctx, out) {
  const { root, finding } = ctx;
  for (const rel of REQUIRED) {
    if (!fs.existsSync(path.join(root, rel))) out.push(finding(rel, 'file of the engine zone', 'file missing'));
  }
  for (const n of NODES) {
    const rel = `${ZONE}/agents/${n}.md`;
    if (!fs.existsSync(path.join(root, rel))) out.push(finding(rel, 'node role', 'file missing'));
  }
  if (!fs.existsSync(path.join(root, ZONE, 'agents', 'run'))) {
    out.push(finding(`${ZONE}/agents/run`, 'at least one executor profile', 'directory missing'));
  }
}

function checkHooks(ctx, expect, out) {
  const { root, finding } = ctx;
  // Хуки этого движка живут в пакете плагина: `miniapps/<id>/.minimax-plugin/`.
  // Пакета нет — охрана и журнал вызовов не работают, и это надо назвать вслух.
  const pkg = path.join(root, 'miniapps', 'minimax-engine', '.minimax-plugin', 'plugin.json');
  const expectedHooks = (expect && expect.hooks) || [];
  if (!expectedHooks.length) {
    if (!fs.existsSync(pkg)) {
      out.push(finding('miniapps/minimax-engine/.minimax-plugin/plugin.json', 'package of the engine (hooks, ledger)', 'package not installed — hooks of the engine do not fire'));
    }
    return;
  }
  if (!fs.existsSync(pkg)) {
    out.push(finding('miniapps/minimax-engine/.minimax-plugin/plugin.json', 'package of the engine', 'file missing'));
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(pkg, 'utf8'));
  } catch (e) {
    out.push(finding('miniapps/minimax-engine/.minimax-plugin/plugin.json', 'valid JSON', e.message));
    return;
  }
  for (const h of expectedHooks) {
    const rel = `miniapps/minimax-engine/${h.file}`;
    if (!fs.existsSync(path.join(root, rel))) out.push(finding(rel, `hook ${h.event}`, 'file missing'));
  }
  if (!Array.isArray(manifest.hooks) || !manifest.hooks.length) {
    out.push(finding('miniapps/minimax-engine/.minimax-plugin/plugin.json → hooks', 'hook files declared', 'hooks array is empty'));
  }
}

function checkBehavior(ctx, out) {
  const { root, finding } = ctx;
  const gen = path.join(root, ZONE, 'scripts', 'gen-roles.cjs');
  if (fs.existsSync(gen)) {
    const r = spawnSync(process.execPath, [gen, '--check'], { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) {
      const why = ((r.stdout || '') + (r.stderr || '')).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 5);
      out.push(finding('node .minimax/scripts/gen-roles.cjs --check', 'exit 0', 'exit ' + r.status + (why.length ? ': ' + why.join(' | ') : '')));
    }
  }
  const caps = path.join(root, ZONE, '.state', 'capabilities.json');
  if (!fs.existsSync(caps)) {
    out.push(finding(`${ZONE}/.state/capabilities.json`, 'facts about the engine (probe)', 'file missing — run node .minimax/scripts/capabilities.cjs'));
  }
}

function check(ctx) {
  const out = [];
  checkFiles(ctx, out);
  checkHooks(ctx, ctx.engine && ctx.engine.expect, out);
  if (ctx.behavior) checkBehavior(ctx, out);
  return out;
}

module.exports = { id: 'minimax', check };
