// project/extensions/: наработки проекта переживают uninstall и переустановку; копии в каталогах движка вторичны.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const FORMA = path.resolve(__dirname, '..', 'bin', 'forma.cjs')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-ext-'))
const forma = (...a) => spawnSync(process.execPath, [FORMA, ...a, '--dir', dir], { encoding: 'utf8' })
const init = () => forma('init', '--engines', 'claude', '--template', 'none', '--board', 'skip', '--lang', 'en', '--yes', '--no-dashboard')
const ext = (...a) => spawnSync(process.execPath, [path.join(dir, '.forma', 'extensions', 'extensions.cjs'), ...a, '--dir', dir], { encoding: 'utf8' })
const p = (...s) => path.join(dir, ...s)
const read = (...s) => fs.readFileSync(p(...s), 'utf8')

test.after(() => fs.rmSync(dir, { recursive: true, force: true }))

test('установка создаёт project/extensions/ с README и кладёт скрипт синхронизации в .forma/', () => {
  const r = init()
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.ok(fs.existsSync(p('project', 'extensions', 'README.md')))
  assert.ok(fs.existsSync(p('.forma', 'extensions', 'extensions.cjs')))
  assert.ok(!fs.existsSync(p('.forma', 'extensions', 'PROJECT-README.md')))
  assert.ok(fs.existsSync(p('.claude', 'hooks', 'sync-extensions.sh')))
  assert.match(read('.claude', 'settings.json'), /sync-extensions\.sh/)
})

test('sync копирует файл проекта, помечает перекрытие файла движка, check видит правку копии', () => {
  fs.mkdirSync(p('project', 'extensions', 'claude', 'agents', 'run'), { recursive: true })
  fs.writeFileSync(p('project', 'extensions', 'claude', 'agents', 'run', 'run-seo.md'), '# mine\n')
  fs.writeFileSync(p('project', 'extensions', 'claude', 'agents', 'run', 'run-text.md'), '# override\n')
  const r = ext('sync')
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /override: \.claude\/agents\/run\/run-text\.md/)
  assert.equal(read('.claude', 'agents', 'run', 'run-seo.md'), '# mine\n')
  assert.equal(read('.claude', 'agents', 'run', 'run-text.md'), '# override\n')
  assert.match(read('.gitignore'), /\/\.claude\/agents\/run\/run-seo\.md/)
  assert.equal(ext('check').status, 0)

  fs.appendFileSync(p('.claude', 'agents', 'run', 'run-seo.md'), 'hand edit\n')
  const c = ext('check')
  assert.equal(c.status, 1)
  assert.match(c.stdout, /edited by hand: \.claude\/agents\/run\/run-seo\.md/)
  const s = ext('sync')
  assert.equal(s.status, 1)
  assert.match(read('.claude', 'agents', 'run', 'run-seo.md'), /hand edit/) // правка не затёрта молча
})

test('uninstall: dry-run перечисляет чужие файлы, --yes переносит их в extensions/ до удаления движка', () => {
  fs.mkdirSync(p('.claude', 'scripts'), { recursive: true })
  fs.writeFileSync(p('.claude', 'scripts', 'my-tool.cjs'), 'x\n')
  const d = forma('uninstall')
  assert.match(d.stdout, /\.claude\/scripts\/my-tool\.cjs -> project\/extensions\/claude\/scripts\/my-tool\.cjs/)
  assert.match(d.stdout, /run-seo\.md\.edited/)
  assert.doesNotMatch(d.stdout, /run-text\.md ->/) // копия, не правка
  assert.ok(!fs.existsSync(p('project', 'extensions', 'claude', 'scripts', 'my-tool.cjs')), 'dry-run ничего не переносит')

  const r = forma('uninstall', '--yes')
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.ok(!fs.existsSync(p('.claude')))
  assert.equal(read('project', 'extensions', 'claude', 'scripts', 'my-tool.cjs'), 'x\n')
  assert.match(read('project', 'extensions', 'claude', 'agents', 'run', 'run-seo.md.edited'), /hand edit/)
  assert.equal(read('project', 'extensions', 'claude', 'agents', 'run', 'run-seo.md'), '# mine\n') // источник не тронут
  assert.doesNotMatch(read('.gitignore'), /Forma: extension copies/)
})

test('переустановка возвращает наработки в каталог движка без ручных действий', () => {
  fs.rmSync(p('project', 'extensions', 'claude', 'agents', 'run', 'run-seo.md.edited'))
  const r = init()
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /override: \.claude\/agents\/run\/run-text\.md/)
  assert.equal(read('.claude', 'agents', 'run', 'run-seo.md'), '# mine\n')
  assert.equal(read('.claude', 'agents', 'run', 'run-text.md'), '# override\n')
  assert.equal(read('.claude', 'scripts', 'my-tool.cjs'), 'x\n')
  assert.equal(ext('check').status, 0)
  assert.equal(read('project', 'extensions', 'claude', 'agents', 'run', 'run-seo.md'), '# mine\n')
})

test('удалён источник — удалена и нетронутая копия', () => {
  fs.rmSync(p('project', 'extensions', 'claude', 'agents', 'run', 'run-seo.md'))
  const r = ext('sync')
  assert.match(r.stdout, /removed: \.claude\/agents\/run\/run-seo\.md/)
  assert.ok(!fs.existsSync(p('.claude', 'agents', 'run', 'run-seo.md')))
})

test('template/ копируется, затем custom/ перекрывает; check без дрейфа', () => {
  for (const layer of ['template', 'custom']) fs.mkdirSync(p('project', 'extensions', layer, 'claude', 'agents', 'run'), { recursive: true })
  const run = (layer, name, text) => fs.writeFileSync(p('project', 'extensions', layer, 'claude', 'agents', 'run', name), text)
  run('template', 'run-a.md', '# template a\n')
  run('template', 'run-b.md', '# template b\n')
  run('custom', 'run-b.md', '# custom b\n')
  const r = ext('sync')
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.equal(read('.claude', 'agents', 'run', 'run-a.md'), '# template a\n')
  assert.equal(read('.claude', 'agents', 'run', 'run-b.md'), '# custom b\n')
  const c = ext('check')
  assert.equal(c.status, 0, c.stdout)
})
