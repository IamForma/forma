'use strict'

// One-time migration of a project installed before the role was named Plumb: the setting row and the cards are
// renamed, obsolete role files are removed. The only file that carries the previous name; it can be dropped
// together with the installer step once no project older than this release is left.
// Obsolete files are protocol-owned configuration (the installer overwrites such files anyway): they go unless the earlier
// install manifest recorded a different hash, i.e. the human edited the file — that one stays and is named in the report.
// A file the manifest does not know (a project updated by other means) is removed too.

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const OLD = 'gau' + 'ge'
const OLD_RU = 'Мери' + 'ло'
const OBSOLETE = [
  `.claude/agents/${OLD}-haiku.md`,
  ...['run', 'scrub', 'scrub.test', 'switch', 'measure'].map((n) => `.claude/scripts/${OLD}-${n}.cjs`),
  `.codex/agents/${OLD}.toml`,
  `.codex/roles/${OLD}.md`,
  `.codex/tests/test-${OLD}-codex.cjs`,
  `.forma/manual/en/03-protocol/${OLD.toUpperCase()}.md`,
  `.forma/manual/ru/03-protocol/${OLD.toUpperCase()}.md`,
]

const rename = (t) => t
  .replace(new RegExp(OLD_RU.replace(/о$/, '') + 'ом', 'g'), 'Отвесом')
  .replace(new RegExp(OLD_RU.replace(/о$/, '') + 'а', 'g'), 'Отвеса')
  .replace(new RegExp(OLD_RU, 'g'), 'Отвес')
  .replace(new RegExp(OLD_RU.toLowerCase().replace(/о$/, '') + 'а', 'g'), 'отвеса')
  .replace(new RegExp(OLD.toUpperCase(), 'g'), 'PLUMB')
  .replace(new RegExp(OLD[0].toUpperCase() + OLD.slice(1), 'g'), 'Plumb')
  .replace(new RegExp(OLD, 'g'), 'plumb')

const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
const walkMd = (dir) => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? walkMd(path.join(dir, e.name)) : /\.md$/.test(e.name) ? [path.join(dir, e.name)] : [])

/** @returns {{lines: string[], changed: number}} */
function migratePlumb(root, previousManifest, { apply = true } = {}) {
  const lines = []
  const files = [path.join(root, 'project', 'config', 'PROJECT.md'), ...walkMd(path.join(root, '.devtool', 'features'))]
  let renamed = 0
  for (const f of files) {
    if (!fs.existsSync(f)) continue
    const before = fs.readFileSync(f, 'utf8')
    const after = rename(before)
    if (after === before) continue
    renamed++
    if (apply) fs.writeFileSync(f, after)
  }
  if (renamed) lines.push(`role rename: PROJECT.md and cards updated in ${renamed} file(s)`)
  const recorded = (previousManifest && previousManifest.files) || {}
  const removed = []
  const kept = []
  for (const rel of OBSOLETE) {
    const f = path.join(root, rel)
    if (!fs.existsSync(f)) continue
    if (!recorded[rel] || recorded[rel] === sha256(f)) { if (apply) fs.rmSync(f); removed.push(rel) } else kept.push(rel)
  }
  if (removed.length) lines.push(`obsolete files removed: ${removed.join(', ')}`)
  if (kept.length) lines.push(`! obsolete files kept (edited since install) — remove by hand: ${kept.join(', ')}`)
  return { lines, changed: renamed + removed.length }
}

module.exports = { migratePlumb, rename, OBSOLETE }
