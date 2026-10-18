'use strict'
// Removes the Forma protocol from a project: `forma uninstall [--dir <path>] [--yes]`.
// Dry-run by default: prints what would go and what stays. `--yes` writes.
// Removed: the engine adapters, the core, AGENTS.md, .env.example, the installer's .gitignore lines, the .forma/protocol gitlink.
// Stays: project/, .devtool/, .env, .mcp.json, .playwright-cli/, the product's own code.

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const TARGETS = ['.claude', '.codex', '.agents', '.forma', 'AGENTS.md', '.env.example']
const KEPT = ['project', '.devtool', '.env', '.mcp.json', '.playwright-cli']
const MANIFEST = path.join('.forma', 'install-manifest.json')
// lines written by the installer into .gitignore (bin/forma.cjs): [line, comment]
const IGNORE_LINES = [
  ['.forma/dashboard/.cache/', 'Forma: dashboard runtime'],
  ['project/cards/*/assets/', 'Forma: card assets stay out of git'],
  ['project/cards/*/work/', 'Forma: card work files stay out of git'],
]

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
  return { root, remove, kept, ignoreLines: lines, gitlink: gitlinkTracked(root) }
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
  for (const t of p.remove) fs.rmSync(path.join(root, t), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  stripGitignore(root)
}

function report(p, yes) {
  const out = []
  out.push(`${yes ? 'Removing' : 'Dry run — would remove'} the Forma protocol from ${p.root}`)
  out.push('Remove:')
  for (const t of p.remove) out.push(`  ${t}`)
  if (p.gitlink) out.push('  index entry .forma/protocol (gitlink)')
  for (const l of p.ignoreLines) out.push(`  .gitignore line: ${l}`)
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
