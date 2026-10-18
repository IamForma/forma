// forma uninstall: dry-run ничего не трогает, --yes снимает протокол и оставляет данные проекта.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const FORMA = path.resolve(__dirname, '..', 'bin', 'forma.cjs')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-uninstall-'))
const run = (...a) => spawnSync(process.execPath, [FORMA, ...a, '--dir', dir], { encoding: 'utf8' })
const has = (f) => fs.existsSync(path.join(dir, f))

test.after(() => fs.rmSync(dir, { recursive: true, force: true }))

test('не установлено — отказ', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-uninstall-empty-'))
  const r = spawnSync(process.execPath, [FORMA, 'uninstall', '--dir', empty], { encoding: 'utf8' })
  fs.rmSync(empty, { recursive: true, force: true })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /Nothing to remove/)
})

test('dry-run ничего не удаляет, --yes снимает протокол и оставляет project/, .devtool/, .env', () => {
  const i = spawnSync(process.execPath, [FORMA, 'init', '--dir', dir, '--engines', 'claude,codex,gemini', '--board', 'skip', '--yes'], { encoding: 'utf8' })
  assert.equal(i.status, 0, i.stdout + i.stderr)
  fs.writeFileSync(path.join(dir, '.env'), 'KEY=1\n')
  fs.writeFileSync(path.join(dir, '.mcp.json'), '{}\n')

  const d = run('uninstall')
  assert.equal(d.status, 0, d.stderr)
  assert.match(d.stdout, /Dry run/)
  for (const f of ['.claude', '.codex', '.agents', '.forma', 'AGENTS.md']) assert.ok(has(f), f + ' ещё на месте')

  const r = run('uninstall', '--yes')
  assert.equal(r.status, 0, r.stdout + r.stderr)
  for (const f of ['.claude', '.codex', '.agents', '.forma', 'AGENTS.md', '.env.example']) assert.ok(!has(f), f + ' удалён')
  for (const f of ['project', '.devtool', '.env', '.mcp.json']) assert.ok(has(f), f + ' остался')
  const gi = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8')
  assert.doesNotMatch(gi, /Forma: dashboard runtime|project\/cards\/\*\/work\//)
  assert.match(gi, /^\.env$/m)

  assert.equal(run('uninstall').status, 1, 'повторно — «нечего удалять»')
})
