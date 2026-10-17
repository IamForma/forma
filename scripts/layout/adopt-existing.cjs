#!/usr/bin/env node
'use strict'
// Adopt an existing project folder: on the first install, every working folder and file already in the project root
// moves into project/source/, so the root keeps only the protocol and the project's own entry files.
// The script knows no project: the root comes from an argument.
//
//   node adopt-existing.cjs [--root <dir>]                      dry run (default): what would move
//   node adopt-existing.cjs --apply [--root <dir>] [--allow-dirty]
//   node adopt-existing.cjs --rollback <journal.json> [--root <dir>]
//
// Stays in the root only what serves the protocol and Git: the protocol's folders and files, Git's own (.git*), the
// environment file (.env*), and project/ (never moved, never entered except for source/). Everything else — README,
// LICENSE, package.json, editor settings, node_modules, a root CLAUDE.md — moves, so the root holds no stray files.
// A name already taken in project/source/ gets a suffix (name-2, name-2.ext) — nothing is overwritten.
// The journal of every move is .forma/living/migrations/adopt-<stamp>.json; --rollback reads it back.
// A locked folder is retried, then copied and deleted; one that still cannot move stays where it is and is named.
// Exit codes: 0 done or nothing to do · 2 stop (dirty tree, an item not moved, bad arguments).

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const SOURCE = path.join('project', 'source')
const JOURNAL_DIR = path.join('.forma', 'living', 'migrations')

// names compared lower-case: the protocol's own root and the project folder; Git's files (.git, .github, .gitignore, ...)
// and the environment file (.env, .env.example) by pattern
const KEEP = new Set(['.claude', '.codex', '.agents', '.forma', '.devtool', '.mcp.json', 'agents.md', 'project'])
const KEEP_PATTERNS = [/^\.git/i, /^\.env(\..*)?$/i]

const isKept = (name) => KEEP.has(name.toLowerCase()) || KEEP_PATTERNS.some((re) => re.test(name))

// first free name inside dir: name, name-2, name-3 (a file keeps its extension: name-2.ext)
function freeName(dir, name, taken) {
  const ext = path.extname(name)
  const stem = ext && ext !== name ? name.slice(0, -ext.length) : name
  const suffix = ext && ext !== name ? ext : ''
  let candidate = name
  for (let n = 2; fs.existsSync(path.join(dir, candidate)) || taken.has(candidate.toLowerCase()); n++) candidate = `${stem}-${n}${suffix}`
  return candidate
}

// what would move: [{ name, kind, to }], `to` relative to the root with forward slashes
function plan(root) {
  const refDir = path.join(root, SOURCE)
  const taken = new Set()
  const items = []
  for (const e of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (isKept(e.name)) continue
    const target = freeName(refDir, e.name, taken)
    taken.add(target.toLowerCase())
    items.push({ name: e.name, kind: e.isDirectory() ? 'dir' : 'file', to: `project/source/${target}` })
  }
  return items
}

function dirtyTree(root) {
  const r = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })
  return r.status === 0 && r.stdout.trim().length > 0
}

function writeJournal(root, moves) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-')
  const rel = path.join(JOURNAL_DIR, `adopt-${stamp}.json`)
  fs.mkdirSync(path.join(root, JOURNAL_DIR), { recursive: true })
  fs.writeFileSync(path.join(root, rel), JSON.stringify({ moves }, null, 2) + '\n')
  return rel.split(path.sep).join('/')
}

// undo moves in reverse order; returns how many went back
function undo(root, moves) {
  let back = 0
  for (const m of [...moves].reverse()) {
    const from = path.join(root, m.name)
    const to = path.join(root, m.to)
    if (fs.existsSync(to) && !fs.existsSync(from)) { fs.renameSync(to, from); back++ }
  }
  return back
}

const LOCKED = new Set(['EPERM', 'EBUSY', 'EACCES', 'EXDEV', 'ENOTEMPTY'])
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

// one move. Windows refuses to rename a folder some process holds open (editor, Explorer, antivirus, file watcher):
// retry a few times, then copy and delete; a copy that cannot be fully deleted is removed again, the source stays whole.
function moveOne(from, to) {
  let last
  for (let i = 0; i < 4; i++) {
    try { fs.renameSync(from, to); return } catch (e) { last = e; if (!LOCKED.has(e.code)) throw e; pause(250) }
  }
  try {
    fs.cpSync(from, to, { recursive: true, errorOnExist: true })
    fs.rmSync(from, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 })
  } catch (e) {
    fs.rmSync(to, { recursive: true, force: true })
    if (!fs.existsSync(from)) throw new Error(`${last.code}; copy fallback left the source incomplete: ${e.message}`)
    throw new Error(`${last.code}: held by another process — close it and run the script again`)
  }
}

// moves the items one by one; a failed item stays in the root and is reported, the rest still move
function apply(root, items) {
  if (!items.length) return { moved: 0, failed: [], journal: null }
  fs.mkdirSync(path.join(root, SOURCE), { recursive: true })
  const done = []
  const failed = []
  for (const m of items) {
    try { moveOne(path.join(root, m.name), path.join(root, m.to)); done.push(m) } catch (e) { failed.push({ name: m.name, error: e.message }) }
  }
  return { moved: done.length, failed, journal: done.length ? writeJournal(root, done) : null }
}

function rollback(root, journalFile) {
  const { moves } = JSON.parse(fs.readFileSync(path.resolve(root, journalFile), 'utf8'))
  return undo(root, moves)
}

module.exports = { plan, apply, rollback, isKept, SOURCE }

if (require.main === module) {
  const argv = process.argv.slice(2)
  const flag = (n) => argv.includes(n)
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[i + 1] : null }
  const stop = (msg) => { console.error('STOP: ' + msg); process.exit(2) }
  const root = path.resolve(opt('--root') || process.cwd())
  if (flag('--rollback') && !opt('--rollback')) stop('--rollback needs a journal file')
  if (!fs.existsSync(root)) stop(`no such folder: ${root}`)
  try {
    if (opt('--rollback')) {
      console.log(`rolled back: ${rollback(root, opt('--rollback'))} item(s)`)
    } else {
      const items = plan(root)
      if (!items.length) console.log('nothing to move')
      else if (!flag('--apply')) {
        console.log(`dry run — ${items.length} item(s) would move:`)
        for (const m of items) console.log(`  ${m.name}${m.kind === 'dir' ? '/' : ''} -> ${m.to}`)
      } else {
        if (!flag('--allow-dirty') && dirtyTree(root)) stop('git tree is not clean (commit first, or pass --allow-dirty)')
        const r = apply(root, items)
        console.log(`moved ${r.moved} item(s); journal ${r.journal}`)
        for (const f of r.failed) console.error(`not moved: ${f.name} — ${f.error}`)
        if (r.failed.length) process.exit(2)
      }
    }
  } catch (e) { stop(e.message) }
}
