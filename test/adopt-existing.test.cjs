// Adopting an existing project folder: working folders and files of the root move into project/source/ on the first install.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const FORMA = path.resolve(__dirname, '..', 'bin', 'forma.cjs')
const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'layout', 'adopt-existing.cjs')

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-adopt-'))
  const w = (f, t = 'x') => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t) }
  w('src/app.js', 'app'); w('assets/logo.png'); w('notes.txt', 'n'); w('export.csv')
  w('README.md'); w('LICENSE'); w('package.json', '{}'); w('.vscode/settings.json'); w('node_modules/m/i.js'); w('CLAUDE.md')
  w('.env', 'K=1'); w('.gitignore', 'x'); w('.github/ci.yml'); w('AGENTS.md')
  return dir
}
const run = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' })
const init = (dir, ...extra) => spawnSync(process.execPath, [FORMA, 'init', '--dir', dir, '--engines', 'claude', '--board', 'skip', '--yes', ...extra], { encoding: 'utf8' })
const ref = (dir, ...p) => path.join(dir, 'project', 'source', ...p)

test('dry run by default: lists, moves nothing, keeps the kept entries out of the list', () => {
  const dir = fixture()
  const r = run(['--root', dir])
  assert.equal(r.status, 0, r.stderr)
  for (const n of ['src/', 'assets/', 'notes.txt', 'export.csv', 'README.md', 'LICENSE', 'package.json', '.vscode/', 'node_modules/', 'CLAUDE.md']) assert.ok(r.stdout.includes(n), n)
  for (const n of ['.env', '.gitignore', '.github', 'AGENTS.md']) assert.ok(!r.stdout.includes(n), n)
  assert.ok(fs.existsSync(path.join(dir, 'src', 'app.js')))
  fs.rmSync(dir, { recursive: true, force: true })
})

test('--apply moves, writes a journal, --rollback puts everything back', () => {
  const dir = fixture()
  const a = run(['--apply', '--allow-dirty', '--root', dir])
  assert.equal(a.status, 0, a.stderr)
  assert.equal(fs.readFileSync(ref(dir, 'src', 'app.js'), 'utf8'), 'app')
  assert.ok(fs.existsSync(ref(dir, 'notes.txt')) && !fs.existsSync(path.join(dir, 'src')))
  assert.ok(fs.existsSync(ref(dir, 'README.md')) && fs.existsSync(ref(dir, 'node_modules', 'm', 'i.js')) && fs.existsSync(ref(dir, 'CLAUDE.md')))
  for (const k of ['.env', '.gitignore', '.github', 'AGENTS.md']) assert.ok(fs.existsSync(path.join(dir, k)), k)
  const journal = a.stdout.match(/journal (\S+)/)[1]
  const b = run(['--rollback', journal, '--root', dir])
  assert.equal(b.status, 0, b.stderr)
  assert.ok(fs.existsSync(path.join(dir, 'src', 'app.js')) && fs.existsSync(path.join(dir, 'notes.txt')) && fs.existsSync(path.join(dir, 'README.md')))
  assert.ok(!fs.existsSync(ref(dir, 'src')))
  fs.rmSync(dir, { recursive: true, force: true })
})

test('a taken name gets a suffix, nothing is overwritten; project/ itself stays', () => {
  const dir = fixture()
  fs.mkdirSync(ref(dir), { recursive: true })
  fs.writeFileSync(ref(dir, 'notes.txt'), 'old'); fs.mkdirSync(ref(dir, 'src'))
  fs.writeFileSync(path.join(dir, 'project', 'JOURNAL.md'), 'mine')
  assert.equal(run(['--apply', '--allow-dirty', '--root', dir]).status, 0)
  assert.equal(fs.readFileSync(ref(dir, 'notes.txt'), 'utf8'), 'old')
  assert.equal(fs.readFileSync(ref(dir, 'notes-2.txt'), 'utf8'), 'n')
  assert.equal(fs.readFileSync(ref(dir, 'src-2', 'app.js'), 'utf8'), 'app')
  assert.equal(fs.readFileSync(path.join(dir, 'project', 'JOURNAL.md'), 'utf8'), 'mine')
  fs.rmSync(dir, { recursive: true, force: true })
})

test('a dirty git tree is a stop without --allow-dirty', () => {
  const dir = fixture()
  spawnSync('git', ['init', '-q'], { cwd: dir })
  const r = run(['--apply', '--root', dir])
  assert.equal(r.status, 2)
  assert.match(r.stderr, /not clean/)
  assert.ok(fs.existsSync(path.join(dir, 'src', 'app.js')))
  fs.rmSync(dir, { recursive: true, force: true })
})

test('installer: --adopt on the first install moves the root content and the scaffold still arrives', () => {
  const dir = fixture()
  const r = init(dir, '--adopt')
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /adopt: 10 item\(s\) moved/)
  assert.ok(fs.existsSync(ref(dir, 'src', 'app.js')) && fs.existsSync(ref(dir, 'assets', 'logo.png')))
  assert.ok(fs.existsSync(path.join(dir, 'project', 'PROJECT.md')) || fs.existsSync(path.join(dir, 'project', 'config', 'PROJECT.md')))
  assert.ok(fs.existsSync(ref(dir, 'README.md')) && !fs.existsSync(path.join(dir, 'README.md')) && !fs.existsSync(path.join(dir, 'CLAUDE.md')))
  assert.match(r.stdout, /install is intact/)
  fs.rmSync(dir, { recursive: true, force: true })
})

// a root CLAUDE.md fails the install check by design (it shadows AGENTS.md), so runs that move nothing leave it out
test('installer: without a flag and without a terminal nothing moves, the report says how', () => {
  const dir = fixture()
  fs.rmSync(path.join(dir, 'CLAUDE.md'))
  const r = init(dir)
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /adopt: found 9 item\(s\).*--adopt/)
  assert.ok(fs.existsSync(path.join(dir, 'src', 'app.js')))
  fs.rmSync(dir, { recursive: true, force: true })
})

test('installer: an update (manifest present) never adopts, even with --adopt', () => {
  const dir = fixture()
  fs.rmSync(path.join(dir, 'CLAUDE.md'))
  assert.equal(init(dir, '--no-adopt').status, 0)
  fs.mkdirSync(path.join(dir, 'later')); fs.writeFileSync(path.join(dir, 'later', 'f.txt'), 'x')
  const r = init(dir, '--adopt')
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /adopt: nothing to move/)
  assert.ok(fs.existsSync(path.join(dir, 'later', 'f.txt')) && fs.existsSync(path.join(dir, 'src', 'app.js')))
  fs.rmSync(dir, { recursive: true, force: true })
})

test('an item that cannot move is named and left, the rest still move, nothing throws', () => {
  const dir = fixture()
  const adopt = require(SCRIPT)
  const items = [...adopt.plan(dir), { name: 'ghost', kind: 'dir', to: 'project/source/ghost' }]
  const r = adopt.apply(dir, items)
  assert.equal(r.failed.length, 1)
  assert.equal(r.failed[0].name, 'ghost')
  assert.equal(r.moved, items.length - 1)
  assert.ok(fs.existsSync(ref(dir, 'src', 'app.js')) && fs.existsSync(r.journal ? path.join(dir, r.journal) : ''))
  fs.rmSync(dir, { recursive: true, force: true })
})
