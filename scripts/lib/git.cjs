// Запуск команд и git для сценариев автора протокола (protocol/scripts). В пакет не входит:
// как и сами сценарии, нужен только там, где protocol/ — git-клон IamForma/forma.
'use strict';
const { spawnSync, execFileSync } = require('child_process');

const MAX_BUFFER = 64 << 20;

/** Команда без оболочки: код возврата и слитые stdout+stderr; не бросает. */
function run(cmd, args, { cwd = process.cwd() } = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

/** `git -C <dir> …`: код возврата и слитые stdout+stderr; не бросает. */
function gitRun(dir, ...args) {
  return run('git', ['-C', dir, ...args]);
}

/** `git -C <dir> …`: stdout строкой; ненулевой код — исключение, stderr не показывается. */
function gitOut(dir, ...args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: MAX_BUFFER, stdio: ['ignore', 'pipe', 'ignore'] });
}

module.exports = { run, gitRun, gitOut };
