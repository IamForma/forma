// Всё, что bin/forma.cjs подключает из scripts/, входит в "files" пакета: иначе npx github:… не найдёт модуль.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const files = require('../package.json').files
const covered = (rel) => files.some((f) => (f.endsWith('/') ? rel.startsWith(f) : rel === f))

test('скрипты, которые подключает bin/forma.cjs, входят в "files" пакета', () => {
  const src = fs.readFileSync(path.join(root, 'bin', 'forma.cjs'), 'utf8')
  const used = [...src.matchAll(/require\('\.\.\/(scripts\/[^']+)'\)/g)].map((m) => m[1])
  assert.ok(used.length > 0)
  for (const rel of used) {
    assert.ok(fs.existsSync(path.join(root, rel)), rel + ' существует')
    assert.ok(covered(rel), rel + ' не входит в "files" package.json')
  }
})
