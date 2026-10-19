'use strict'
// Project extensions: roles, skills, scripts and hooks a project builds on top of the protocol live in
// project/extensions/<engine>/ and survive `forma uninstall`. This module copies them into the engine
// folders (the engines read only their own folders) and reports drift.
//   project/extensions/claude/ -> .claude/    project/extensions/codex/ -> .codex/    project/extensions/agents/ -> .agents/
// Layers, later wins on the same relative path:
//   project/extensions/<engine>/           (unsorted, the oldest layout)
//   project/extensions/template/<engine>/  (what the project takes from a shared project template)
//   project/extensions/custom/<engine>/    (what belongs to this project alone; overrides template)
// CLI: node extensions.cjs [sync|check] [--dir <path>]

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const ROOT_DIR = path.join('project', 'extensions')
const LAYERS = ['', 'template', 'custom'] // '' = project/extensions/<engine>/ directly
const ENGINE_DIRS = { claude: '.claude', codex: '.codex', agents: '.agents' }
const STATE = path.join('.forma', 'extensions-state.json')
const BLOCK_START = '# Forma: extension copies (generated from project/extensions/)'
const BLOCK_END = '# Forma: end of extension copies'

const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const posix = (p) => p.split(path.sep).join('/')

function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.sessions' || e.name === 'node_modules') continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, base, out)
    else out.push(path.relative(base, full))
  }
  return out
}

/** Source files of the extensions: [{ engine, rel, layer, src, dst }] — `dst` is relative to the project root; on a clash the later layer wins. */
function sources(root) {
  const byDst = new Map()
  for (const [engine, dirName] of Object.entries(ENGINE_DIRS)) {
    for (const layer of LAYERS) {
      const base = path.join(root, ROOT_DIR, ...(layer ? [layer] : []), engine)
      for (const rel of walk(base)) byDst.set(posix(path.join(dirName, rel)), { engine, rel, layer, src: path.join(base, rel), dst: path.join(dirName, rel) })
    }
  }
  return [...byDst.values()]
}

function readState(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, STATE), 'utf8')).files || {} } catch { return {} }
}
function writeState(root, files) {
  const f = path.join(root, STATE)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, JSON.stringify({ stateVersion: 1, files }, null, 2) + '\n')
}

// The generated copies are listed in .gitignore between two marker lines, rewritten on every sync.
function writeIgnoreBlock(root, dsts) {
  const gi = path.join(root, '.gitignore')
  const lines = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8').split(/\r?\n/) : []
  const a = lines.indexOf(BLOCK_START)
  const b = lines.indexOf(BLOCK_END)
  const kept = a >= 0 && b > a ? [...lines.slice(0, a), ...lines.slice(b + 1)] : lines
  while (kept.length && kept[kept.length - 1] === '') kept.pop()
  if (dsts.length) kept.push('', BLOCK_START, ...dsts.map((d) => '/' + posix(d)), BLOCK_END)
  if (!kept.length && !fs.existsSync(gi)) return
  fs.writeFileSync(gi, kept.join('\n') + '\n')
}

/** The installer has just overwritten these files with engine defaults: forget their records so they are not read as hand edits. */
function forgetOwned(root, owned) {
  const state = readState(root)
  const keep = {}
  for (const [k, v] of Object.entries(state)) if (!owned.has(path.resolve(root, k))) keep[k] = v
  if (Object.keys(keep).length !== Object.keys(state).length) writeState(root, keep)
}

/** Removes the generated-copies block from .gitignore (uninstall). */
function stripIgnoreBlock(root) {
  const gi = path.join(root, '.gitignore')
  if (!fs.existsSync(gi)) return
  const lines = fs.readFileSync(gi, 'utf8').split(/\r?\n/)
  const a = lines.indexOf(BLOCK_START)
  const b = lines.indexOf(BLOCK_END)
  if (a < 0 || b < a) return
  const rest = [...lines.slice(0, a), ...lines.slice(b + 1)]
  while (rest.length && rest[rest.length - 1] === '') rest.pop()
  while (a > 0 && rest[a - 1] === '' && rest[a] === '') rest.splice(a, 1)
  fs.writeFileSync(gi, rest.join('\n') + '\n')
}

/**
 * Copies project/extensions/<engine>/ into the engine folders.
 * The project wins on a name clash with an engine file (`overrides`); a copy edited by hand is never overwritten (`drift`).
 * With `dry`, only reports. Returns { written, overrides, drift, removed }.
 */
function sync(root, { dry = false } = {}) {
  const state = readState(root)
  const next = {}
  const res = { written: [], overrides: [], drift: [], removed: [] }
  const srcs = sources(root)
  for (const { rel, src, dst, engine } of srcs) {
    const key = posix(dst)
    const full = path.join(root, dst)
    const srcHash = sha(src)
    const rec = state[key]
    const exists = fs.existsSync(full)
    const curHash = exists ? sha(full) : null
    if (exists && rec && curHash !== rec.copy && curHash !== srcHash) { // the copy was edited by hand
      res.drift.push(key)
      next[key] = rec
      continue
    }
    if (exists && curHash === srcHash) { next[key] = { src: srcHash, copy: srcHash, override: rec ? rec.override : false }; continue }
    const override = exists && !rec
    if (override) res.overrides.push(key)
    if (!dry) {
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.copyFileSync(src, full)
    }
    res.written.push(key)
    next[key] = { src: srcHash, copy: srcHash, override: override || (rec ? rec.override : false), engine, rel: posix(rel) }
  }
  // a copy whose source is gone: remove it if it is still exactly what we wrote
  for (const [key, rec] of Object.entries(state)) {
    if (next[key]) continue
    const full = path.join(root, key)
    if (fs.existsSync(full) && sha(full) === rec.copy) {
      if (!dry) fs.rmSync(full, { force: true })
      res.removed.push(key)
    } else if (fs.existsSync(full)) {
      res.drift.push(key)
      next[key] = rec
    }
  }
  if (!dry) {
    if (srcs.length || Object.keys(state).length) writeState(root, next)
    if (srcs.length || Object.keys(state).length) writeIgnoreBlock(root, Object.keys(next))
  }
  return res
}

/** Read-only check: copies missing, stale or edited by hand. Returns { problems: [...] }. */
function check(root) {
  const state = readState(root)
  const problems = []
  for (const { src, dst } of sources(root)) {
    const key = posix(dst)
    const full = path.join(root, dst)
    if (!fs.existsSync(full)) { problems.push(`missing copy: ${key}`); continue }
    const cur = sha(full)
    const rec = state[key]
    if (rec && cur !== rec.copy && cur !== sha(src)) problems.push(`copy edited by hand: ${key} (move the edit into project/extensions/, then sync)`)
    else if (cur !== sha(src)) problems.push(`stale copy: ${key}`)
  }
  return { problems }
}

/**
 * Files in the engine folders that are neither in the release's adapter set nor a generated copy:
 * the project's own work. `release` is a Set of posix paths relative to the project root the installer would write.
 * Returns [{ engine, rel, from }] — `from` relative to the root. Only `.claude` is scanned by default: the Codex and Gemini folders hold
 * roles and mirrors generated from it (sync-codex), which are not the project's own.
 */
function foreign(root, release, engines = ['claude']) {
  const state = readState(root)
  const out = []
  for (const engine of engines) {
    const dirName = ENGINE_DIRS[engine]
    const base = path.join(root, dirName)
    for (const rel of walk(base)) {
      const key = posix(path.join(dirName, rel))
      if (release.has(key) || isRuntime(key)) continue
      if (state[key]) { // a generated copy: only a hand edit is worth keeping, beside its source
        if (sha(path.join(base, rel)) !== state[key].copy) out.push({ engine, rel: posix(rel) + '.edited', from: key })
        continue
      }
      out.push({ engine, rel: posix(rel), from: key })
    }
  }
  return out
}

// settings and caches the engines write themselves: not the project's work, never moved
const RUNTIME = [/^\.claude\/hooks\/\.[^/]+$/, /^\.claude\/settings(\.local)?\.json$/, /^\.claude\/permission-level\.state\.json$/, /^\.claude\/\.mcp\.json$/, /^\.claude\/projects\//,
  /^\.codex\/config\.toml$/, /^\.codex\/(sessions|cache)\//, /^\.agents\/plugins\/forma\/mcp_config\.json$/]
function isRuntime(key) { return RUNTIME.some((r) => r.test(key)) }

/** Moves foreign files into project/extensions/<engine>/<rel>; an existing target is kept and the move is skipped. */
function moveForeign(root, list) {
  const moved = []
  const skipped = []
  for (const f of list) {
    const to = path.join(root, ROOT_DIR, f.engine, f.rel)
    if (fs.existsSync(to)) { skipped.push(f.from); continue }
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(path.join(root, f.from), to)
    moved.push(f.from)
  }
  return { moved, skipped }
}

function main(argv) {
  const cmd = ['sync', 'check'].includes(argv[0]) ? argv[0] : 'sync'
  const i = argv.indexOf('--dir')
  const root = path.resolve(i >= 0 ? argv[i + 1] : process.cwd())
  if (cmd === 'check') {
    const { problems } = check(root)
    for (const p of problems) console.log(p)
    if (!problems.length) console.log('extensions: copies match project/extensions/')
    return problems.length ? 1 : 0
  }
  const r = sync(root)
  for (const k of r.overrides) console.log(`override: ${k} (project replaces the engine default)`)
  for (const k of r.drift) console.log(`drift: ${k} was edited by hand — kept; move the edit into project/extensions/ or delete the copy`)
  for (const k of r.removed) console.log(`removed: ${k} (source gone)`)
  console.log(`extensions: ${r.written.length} copied, ${r.removed.length} removed, ${r.drift.length} drifted`)
  return r.drift.length ? 1 : 0
}

module.exports = { forgetOwned, ROOT_DIR, LAYERS, ENGINE_DIRS, STATE, sources, sync, check, foreign, moveForeign, stripIgnoreBlock, main }

if (require.main === module) process.exitCode = main(process.argv.slice(2))
