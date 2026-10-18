'use strict'
// Removes the Forma protocol from a project: `forma uninstall [--dir <path>] [--yes]`.
// Dry-run by default: prints what would go and what stays. `--yes` writes.
// Removed: the engine adapters, the core, AGENTS.md, .env.example, the installer's .gitignore lines, the .forma/protocol gitlink.
// Moved first: files in .claude/ that are not part of the release (the project's own work) go to project/extensions/claude/.
// Stays: project/, .devtool/, .env, .mcp.json, .playwright-cli/, the product's own code.

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const extensions = require('../skills/forma/core/extensions/extensions.cjs')

const SKILL = path.join(__dirname, '..', 'skills', 'forma')

const TARGETS = ['.claude', '.codex', '.agents', '.forma', 'AGENTS.md', '.env.example']
const KEPT = ['project', '.devtool', '.env', '.mcp.json', '.playwright-cli']
const MANIFEST = path.join('.forma', 'install-manifest.json')
// lines written by the installer into .gitignore (bin/forma.cjs): [line, comment]
const IGNORE_LINES = [
  ['.forma/dashboard/.cache/', 'Forma: dashboard runtime'],
  ['project/cards/*/assets/', 'Forma: card assets stay out of git'],
  ['project/cards/*/work/', 'Forma: card work files stay out of git'],
]

// Paths (posix, relative to the project root) the installer writes into .claude/: the adapter folders and files, plus the core's skills.
function releaseSetClaude() {
  const set = new Set()
  const add = (base, prefix) => {
    if (!fs.existsSync(base)) return
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name)
        if (e.isDirectory()) walk(full)
        else set.add(prefix + path.relative(base, full).split(path.sep).join('/'))
      }
    }
    walk(base)
  }
  const A = path.join(SKILL, 'adapters', 'claude')
  for (const d of ['rules', 'agents', 'hooks', 'scripts', 'skills']) add(path.join(A, d), '.claude/' + d + '/')
  for (const f of ['forma-adapter.cjs', 'verify-profile.cjs', 'permission-levels.json']) set.add('.claude/' + f)
  add(path.join(SKILL, 'core', 'skills'), '.claude/skills/')
  // what a project template puts into .claude/ (bin/forma.cjs, templateFiles) is the release's too
  const TEMPLATES = path.join(__dirname, '..', 'templates')
  if (fs.existsSync(TEMPLATES)) {
    for (const t of fs.readdirSync(TEMPLATES, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const T = path.join(TEMPLATES, t.name, 'skills')
      if (!fs.existsSync(T)) continue
      add(path.join(T, t.name, 'template', 'scripts'), '.claude/scripts/')
      for (const e of fs.readdirSync(T, { withFileTypes: true })) {
        if (e.isDirectory() && e.name !== t.name) add(path.join(T, e.name), '.claude/skills/' + e.name + '/')
      }
    }
  }
  return set
}

function isInstalled(root) {
  return fs.existsSync(path.join(root, 'AGENTS.md')) || fs.existsSync(path.join(root, MANIFEST))
}

function gitlinkTracked(root) {
  const r = spawnSync('git', ['-C', root, 'ls-files', '-s', '--', '.forma/protocol'], { encoding: 'utf8' })
  return r.status === 0 && /^160000 /.test(r.stdout)
}

// What would be done. Pure read.
function plan(root) {
  const remove = TARGETS.filter((t) => fs.existsSync(path.join(root, t)))
  const kept = KEPT.filter((t) => fs.existsSync(path.join(root, t)))
  const gi = path.join(root, '.gitignore')
  const present = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8').split(/\r?\n/).map((x) => x.trim()) : []
  const lines = IGNORE_LINES.map(([l]) => l).filter((l) => present.includes(l))
  const own = extensions.foreign(root, releaseSetClaude(), ['claude'])
  return { root, remove, kept, ignoreLines: lines, gitlink: gitlinkTracked(root), own }
}

function stripGitignore(root) {
  const gi = path.join(root, '.gitignore')
  if (!fs.existsSync(gi)) return
  const src = fs.readFileSync(gi, 'utf8').split(/\r?\n/)
  const drop = new Set()
  src.forEach((line, i) => {
    const hit = IGNORE_LINES.find(([l]) => l === line.trim())
    if (!hit) return
    drop.add(i)
    if (i > 0 && src[i - 1].trim() === `# ${hit[1]}`) drop.add(i - 1)
  })
  if (!drop.size) return
  fs.writeFileSync(gi, src.filter((_, i) => !drop.has(i)).join('\n'))
}

function apply(p) {
  const { root } = p
  // the script may be running from inside .forma/: leave before deleting it
  try { process.chdir(root) } catch { /* root unreachable: rmSync reports it */ }
  if (p.gitlink) {
    const r = spawnSync('git', ['-C', root, 'rm', '--cached', '-q', '-f', '--', '.forma/protocol'], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`git rm --cached .forma/protocol failed: ${(r.stderr || r.stdout).trim()}`)
  }
  // the project's own files in the engine folders go to project/extensions/ first: nothing built on top of the protocol is lost
  if (p.own.length) p.moved = extensions.moveForeign(root, p.own)
  for (const t of p.remove) fs.rmSync(path.join(root, t), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  stripGitignore(root)
  extensions.stripIgnoreBlock(root)
}

function report(p, yes) {
  const out = []
  out.push(`${yes ? 'Removing' : 'Dry run — would remove'} the Forma protocol from ${p.root}`)
  out.push('Remove:')
  for (const t of p.remove) out.push(`  ${t}`)
  if (p.gitlink) out.push('  index entry .forma/protocol (gitlink)')
  for (const l of p.ignoreLines) out.push(`  .gitignore line: ${l}`)
  if (p.own.length) {
    out.push(`Not part of the release — ${yes ? 'moved' : 'will be moved'} to project/extensions/ before removal:`)
    for (const f of p.own) out.push(`  ${f.from} -> project/extensions/${f.engine}/${f.rel}`)
  }
  out.push('Stays:')
  for (const t of p.kept) out.push(`  ${t}`)
  out.push('  the product code and everything not listed above')
  if (!yes) out.push('\nRerun with --yes to apply.')
  return out.join('\n')
}

// Entry point for `forma uninstall`. Returns the exit code.
function run({ dir, yes }) {
  const root = path.resolve(dir)
  if (!fs.existsSync(root) || !isInstalled(root)) {
    console.error(`No Forma protocol found in ${root} (no AGENTS.md, no ${MANIFEST}). Nothing to remove.`)
    return 1
  }
  const p = plan(root)
  console.log(report(p, yes))
  if (!yes) return 0
  apply(p)
  console.log('\nDone. The protocol is removed; project/ and .devtool/ are left as data.')
  return 0
}

module.exports = { plan, apply, run, TARGETS, KEPT }
