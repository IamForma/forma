#!/usr/bin/env node
'use strict'
// Installer of the Forma protocol: `npx github:IamForma/forma init`.
// Dependency-free Node. Always installs the core, then three steps: engines, project template, Kanban Markdown.
// A rerun is an update: the schema configuration is overwritten; `project/`, the board and `.forma/living/` are left alone.

const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline')
const { spawnSync } = require('node:child_process')
const { walk, projectFile } = require('../skills/forma/core/dashboard/lib/fs.cjs')
const i18n = require('../skills/forma/core/i18n/index.cjs')
const { parseLong } = require('../skills/forma/core/dashboard/lib/cli.cjs')
const verifyInstall = require('../skills/forma/core/verify/verify-install.cjs')

const PKG = path.resolve(__dirname, '..')
const VERSION = require('../package.json').version
const SKILL = path.join(PKG, 'skills', 'forma')
const CORE = path.join(SKILL, 'core')
const ADAPTERS = path.join(SKILL, 'adapters')
const TEMPLATES = path.join(PKG, 'templates')
const EXT_ID = 'LachyFS.kanban-markdown'
const EDITOR_CLIS = ['code', 'antigravity-ide', 'antigravity']
const ENGINES = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'gemini', label: 'Gemini (Antigravity)' },
]

// ---------- arguments ----------
function parseArgs(argv) {
  const { opts, rest } = parseLong(argv, ['help', 'yes', 'version'])
  const o = { cmd: 'init', dir: process.cwd(), ...opts }
  if (rest[0]) o.cmd = rest[0]
  o.dir = path.resolve(o.dir)
  return o
}

const HELP = `forma ${VERSION} init — install/update the Forma protocol in the current folder

  npx github:IamForma/forma init [flags]

  --engines  claude[,codex,gemini]   engines (codex, gemini — beta, in development, but installable)
  --template <name>|none             project template from templates/ (default: none)
  --board    auto|skip               Kanban Markdown: find editor CLIs and install (default: auto)
  --lang     <code>                  project document language (default: en). Catalogs shipped: en, ru; any other code (fr, de, ...)
                                     works too: the agent translates the scaffold after install, hook messages stay English
  --dir      <path>                  project root (default: current folder)
  --yes                              no questions, defaults for anything missing
  --version                          print the installer version and exit

All four flags set (or --yes, or no terminal) — the menu is not shown.
`

// ---------- input ----------
function makeAsk() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const lines = []
  let waiter = null
  rl.on('line', (l) => { if (waiter) { const w = waiter; waiter = null; w(l) } else lines.push(l) })
  rl.on('close', () => { if (waiter) { const w = waiter; waiter = null; w('') } })
  const ask = (q) => new Promise((res) => {
    process.stdout.write(q)
    if (lines.length) { const l = lines.shift(); process.stdout.write(l + '\n'); res(l) } else waiter = res
  })
  ask.close = () => rl.close()
  return ask
}

// ---------- files ----------
const stats = { written: 0, kept: 0 }
const owned = new Set() // files written by the installer in this pass: the install manifest is built from them
// live counter of installed files (terminal only, so piped output and tests stay clean)
function progress() {
  if (process.stdout.isTTY && stats.written % 5 === 0) process.stdout.write(`\r  installing files: ${stats.written}`)
}
function progressDone() {
  if (process.stdout.isTTY) process.stdout.write(`\r  installing files: ${stats.written} — done
`)
}
function copyFile(src, dst, { overwrite = true } = {}) {
  if (fs.existsSync(dst) && !overwrite) { stats.kept++; return false }
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.copyFileSync(src, dst)
  stats.written++
  progress()
  owned.add(dst)
  return true
}
function copyTree(src, dst, opts = {}) {
  if (!fs.existsSync(src)) return
  const st = fs.statSync(src)
  if (st.isFile()) { copyFile(src, dst, opts); return }
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === '.sessions' || e.name === 'node_modules') continue
    const s = path.join(src, e.name)
    const d = path.join(dst, e.name)
    if (opts.skip && opts.skip(d)) { stats.kept++; continue }
    if (e.isDirectory()) copyTree(s, d, opts)
    else copyFile(s, d, opts)
  }
}
function ensureLine(file, line, comment) {
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  if (text.split(/\r?\n/).some((l) => l.trim() === line)) return
  fs.appendFileSync(file, (text && !text.endsWith('\n') ? '\n' : '') + (comment ? `# ${comment}\n` : '') + line + '\n')
}

// ---------- step 0: Git ----------
function gitBoundary(root) {
  const r = spawnSync(process.execPath, [path.join(PKG, 'scripts', 'initialize-project-git.cjs'), root], { encoding: 'utf8' })
  if (r.status !== 0) {
    process.stderr.write(r.stderr || r.stdout)
    process.exit(1)
  }
  return r.stdout.trim()
}

// ---------- migration from the old layout ----------
// A project installed before the `.forma/` layout (`board/`, `dashboard/`, `living/`, `manual/`, `skills/`,
// `templates/`, `protocol/` in the root) — the layout-* scripts move them into `.forma/` and fix
// text references. `project/` and `.devtool/` are the human zone: the move touches nothing there (`--exclude`).
const LAYOUT = path.join(PKG, 'scripts', 'layout')
const LAYOUT_MAP = path.join(LAYOUT, 'layout-map.json')

function oldLayoutMoves(root) {
  if (!fs.existsSync(LAYOUT_MAP)) return []
  const { moves } = JSON.parse(fs.readFileSync(LAYOUT_MAP, 'utf8'))
  return moves.filter((m) => fs.existsSync(path.join(root, m.from)) && !fs.existsSync(path.join(root, m.to)))
}

// A file under a moved directory that is absent from the core/templates reference was put there
// by a human in the old layout; it moves with the directory (git mv) and is only listed in the
// report. `protocol/` has no reference inside PKG — skipped.
function userFilesAfterMove(root, moved) {
  const refFor = (from) => (from === 'templates' ? TEMPLATES : from === 'protocol' ? null : path.join(CORE, from))
  const extra = []
  for (const mv of moved) {
    const ref = refFor(mv.from)
    if (!ref) continue
    const refFiles = new Set(fs.existsSync(ref) ? walk(ref, { symlinks: true }) : [])
    const movedDir = path.join(root, mv.to)
    if (!fs.existsSync(movedDir)) continue
    for (const rel of walk(movedDir, { symlinks: true })) {
      if (!refFiles.has(rel)) extra.push(mv.to + '/' + rel)
    }
  }
  return extra
}

function migrateLayout(root) {
  const moved = oldLayoutMoves(root)
  if (!moved.length) return 'old layout migration: not needed (nothing changed)'
  const r = spawnSync(process.execPath, [
    path.join(LAYOUT, 'layout-rewrite.cjs'), '--map', LAYOUT_MAP, '--root', root, '--apply',
    '--exclude', 'project/', '--exclude', '.devtool/',
  ], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error('STOP: old layout migration failed:\n' + (r.stdout || '') + (r.stderr || ''))
  const extra = userFilesAfterMove(root, moved)
  const lines = ['old layout migration: ' + r.stdout.trim().split('\n')[0]]
  if (extra.length) lines.push('  user files preserved: ' + extra.join(', '))
  return lines.join('\n')
}

// Static project configs (`PROJECT.md`, `CONFIG.md`, `SETUP.md`, `ROUTE.md`, `SITE.md`) used to live in `project/`;
// now they live in `project/config/`. Same layout-* scripts: they move the files and fix exact paths in text
// (history — cards, `JOURNAL`/`CHANGELOG`, other engines — is in the map exclusions).
const CONFIG_MAP = path.join(LAYOUT, 'layout-config-map.json')

function migrateMap(root, mapFile, label) {
  const { moves } = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
  const pending = moves.filter((m) => fs.existsSync(path.join(root, m.from)) && !fs.existsSync(path.join(root, m.to)))
  if (!pending.length) return `${label} migration: not needed (nothing changed)`
  const r = spawnSync(process.execPath, [path.join(LAYOUT, 'layout-rewrite.cjs'), '--map', mapFile, '--root', root, '--apply'], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`STOP: ${label} migration failed:\n` + (r.stdout || '') + (r.stderr || ''))
  return `${label} migration: ` + pending.map((m) => path.basename(m.from)).join(', ') + '. ' + r.stdout.trim().split('\n')[0]
}
const migrateConfig = (root) => migrateMap(root, CONFIG_MAP, 'config to project/config/')
const OPS_MAP = path.join(LAYOUT, 'layout-ops-map.json')
const migrateOps = (root) => migrateMap(root, OPS_MAP, 'service files to project/ops/')

// ---------- core ----------
function installCore(root, protectedPaths) {
  const skip = (d) => protectedPaths.has(path.resolve(d))
  const forma = path.join(root, '.forma')
  copyFile(path.join(CORE, 'AGENTS.md'), path.join(root, 'AGENTS.md'))
  copyTree(path.join(CORE, 'manual'), path.join(forma, 'manual'))
  copyTree(path.join(CORE, 'board'), path.join(forma, 'board'))
  copyTree(path.join(CORE, 'verify'), path.join(forma, 'verify'))
  copyTree(path.join(CORE, 'i18n'), path.join(forma, 'i18n'))
  copyTree(path.join(CORE, 'skills'), path.join(forma, 'skills'), { skip })
  // dashboard: code is overwritten, the human's settings are not
  copyTree(path.join(CORE, 'dashboard'), path.join(forma, 'dashboard'), {
    skip: (d) => /graphify\.config\.json$/.test(d) && fs.existsSync(d),
  })
  // living files — only add what is missing
  copyTree(path.join(CORE, 'living'), path.join(forma, 'living'), { overwrite: false })
  const features = path.join(root, '.devtool', 'features')
  const boardState = fs.existsSync(features) ? 'already present, untouched' : 'created'
  if (!fs.existsSync(features)) copyTree(path.join(CORE, '.devtool', 'features'), features)
  // project/ — first install only
  const projectDir = path.join(root, 'project')
  let projectState = 'already existed, untouched'
  if (!fs.existsSync(projectDir)) {
    copyTree(path.join(CORE, 'project'), projectDir)
    projectState = 'scaffold created'
  }
  ensureLine(path.join(root, '.gitignore'), '.forma/dashboard/.cache/', 'Forma: dashboard runtime')
  return { boardState, projectState, projectCreated: projectState === 'scaffold created' }
}

// ---------- Claude adapter ----------
const CLAUDE_HOOKS = {
  PreToolUse: [{ hooks: ['guard-delete.sh', 'tool-usage.sh'] }],
  UserPromptSubmit: [{ hooks: ['unlock-delete.sh'] }],
  SessionStart: [{ matcher: 'startup', hooks: ['check-ready.sh', ['check-plugin-update.sh', 15], 'check-dashboard.sh', 'intent-start.sh'] }],
  PostToolUse: [{ matcher: 'Write|Edit', hooks: ['check-card.sh'] }],
}
function mergeClaudeSettings(root) {
  const file = path.join(root, '.claude', 'settings.json')
  let s = {}
  if (fs.existsSync(file)) {
    try { s = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { throw new Error(`.claude/settings.json is not valid JSON — fix it by hand and rerun`) }
  }
  s.env = s.env || {}
  if (!s.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW) s.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = '200000'
  s.hooks = s.hooks || {}
  for (const [event, groups] of Object.entries(CLAUDE_HOOKS)) {
    s.hooks[event] = s.hooks[event] || []
    for (const g of groups) {
      let group = s.hooks[event].find((x) => (x.matcher || '') === (g.matcher || ''))
      if (!group) { group = g.matcher ? { matcher: g.matcher, hooks: [] } : { hooks: [] }; s.hooks[event].push(group) }
      group.hooks = group.hooks || []
      for (const h of g.hooks) {
        const [name, timeout] = Array.isArray(h) ? h : [h]
        const command = `bash .claude/hooks/${name}`
        if (group.hooks.some((x) => x.command === command)) continue
        const entry = { type: 'command', command }
        if (timeout) entry.timeout = timeout
        group.hooks.push(entry)
      }
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n')
}
function installClaude(root, protectedPaths) {
  const A = path.join(ADAPTERS, 'claude')
  const C = path.join(root, '.claude')
  const skip = (d) => protectedPaths.has(path.resolve(d))
  copyFile(path.join(A, 'forma-adapter.cjs'), path.join(C, 'forma-adapter.cjs')) // core/adapter boundary: the core finds it by file name
  copyFile(path.join(A, 'verify-profile.cjs'), path.join(C, 'verify-profile.cjs')) // install verify profile: the core finds it via the manifest
  copyTree(path.join(A, 'rules'), path.join(C, 'rules'))
  copyTree(path.join(A, 'agents'), path.join(C, 'agents'))
  copyTree(path.join(A, 'hooks'), path.join(C, 'hooks'))
  for (const f of fs.readdirSync(path.join(C, 'hooks'))) {
    if (f.endsWith('.sh')) try { fs.chmodSync(path.join(C, 'hooks', f), 0o755) } catch { /* exec bits cannot be set on filesystems without chmod (Windows) — bash will run the hook */ }
  }
  copyTree(path.join(A, 'scripts'), path.join(C, 'scripts'), { skip })
  copyTree(path.join(A, 'skills'), path.join(C, 'skills'), { skip })
  // interview delivered from the core — a copy, no edits
  copyTree(path.join(CORE, 'skills'), path.join(C, 'skills'), { skip })
  copyTree(path.join(A, 'dashboard'), path.join(root, '.forma', 'dashboard'))
  mergeClaudeSettings(root)
  const rootClaude = path.join(root, 'CLAUDE.md')
  return fs.existsSync(rootClaude)
    ? 'CLAUDE.md found in the root — it shadows reading AGENTS.md; move anything unique into .claude/rules/claude-8.md and delete it'
    : null
}

// ---------- templates ----------
function listTemplates() {
  if (!fs.existsSync(TEMPLATES)) return []
  return fs.readdirSync(TEMPLATES, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => {
    const readme = path.join(TEMPLATES, e.name, 'README.md')
    let title = ''
    if (fs.existsSync(readme)) title = (fs.readFileSync(readme, 'utf8').split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#')) || '').trim()
    return { name: e.name, title: title.slice(0, 110) }
  })
}
function readProjectTemplate(root) {
  const f = projectFile(root, 'PROJECT.md')
  if (!fs.existsSync(f)) return null
  const name = i18n.rowValue(i18n.reader(fs.readFileSync(f, 'utf8')).table('template'), 'name')
  const value = name && name.trim()
  return value && value !== '—' && value !== 'нет' && value !== 'none' ? value : null
}
function templateFiles(name) {
  // what a template puts into the project: [source, path in the project]
  const T = path.join(TEMPLATES, name, 'skills')
  const out = []
  const own = path.join(T, name, 'template')
  const add = (src, dst) => {
    for (const rel of walk(src, { symlinks: true })) out.push([path.join(src, rel), path.join(dst, rel)])
  }
  add(path.join(own, 'project'), 'project')
  add(path.join(own, 'scripts'), path.join('.claude', 'scripts'))
  for (const e of fs.readdirSync(T, { withFileTypes: true })) {
    if (e.isDirectory() && e.name !== name) add(path.join(T, e.name), path.join('.claude', 'skills', e.name))
  }
  return out
}
function installTemplate(root, name, projectCreated) {
  const files = templateFiles(name)
  let written = 0, kept = 0
  for (const [src, rel] of files) {
    const dst = path.join(root, rel)
    const inProject = rel.split(path.sep)[0] === 'project'
    if (inProject && !projectCreated) { kept++; continue }
    if (fs.existsSync(dst) && !projectCreated) { kept++; continue }
    copyFile(src, dst); written++
  }
  if (projectCreated) {
    const f = projectFile(root, 'PROJECT.md')
    let t = fs.readFileSync(f, 'utf8')
    // a fresh scaffold is English (translation comes later); the rows are found by anchor
    t = i18n.setRow(t, 'name', `\`${name}\``)
    t = i18n.setRow(t, 'source', `forma plugin, \`templates/${name}\``)
    t = i18n.setRow(t, 'status', '`forming with the human`')
    fs.writeFileSync(f, t)
  }
  return { written, kept }
}

// ---------- Kanban Markdown ----------
function runCli(cli, args) {
  const extra = process.env.FORMA_EXTENSIONS_DIR ? ['--extensions-dir', process.env.FORMA_EXTENSIONS_DIR] : []
  const win = process.platform === 'win32'
  const all = [...extra, ...args]
  // Windows: editor CLIs are .cmd wrappers and run only through the shell; arguments are our constants and a quoted path
  return win
    ? spawnSync([cli, ...all.map((a) => (/\s/.test(a) ? `"${a}"` : a))].join(' '), { encoding: 'utf8', shell: true, timeout: 180000 })
    : spawnSync(cli, all, { encoding: 'utf8', timeout: 180000 })
}
function board(mode) {
  const lines = []
  if (mode === 'skip') return [`skipped (--board skip); install it yourself: code --install-extension ${EXT_ID}`]
  let found = 0
  for (const cli of EDITOR_CLIS) {
    const list = runCli(cli, ['--list-extensions'])
    if (list.error || list.status !== 0) continue
    found++
    if (list.stdout.toLowerCase().split(/\r?\n/).includes(EXT_ID.toLowerCase())) { lines.push(`${cli}: ✓ ok`); continue }
    const inst = runCli(cli, ['--install-extension', EXT_ID])
    const again = runCli(cli, ['--list-extensions'])
    if (inst.status === 0 && again.stdout.toLowerCase().includes(EXT_ID.toLowerCase())) lines.push(`${cli}: ✓ installed`)
    else lines.push(`${cli}: ✗ failed — run manually: ${cli} --install-extension ${EXT_ID}`)
  }
  if (!found) lines.push(`No editor CLI found (${EDITOR_CLIS.join(', ')}). Install the extension yourself: code --install-extension ${EXT_ID} (or from the extensions marketplace: Kanban Markdown, LachyFS)`)
  return lines
}

/// step 1: engines — by flag, from the menu, or claude by default; an unknown one exits with 2
async function chooseEngines(o, ask) {
  let engines = o.engines
  if (!engines && ask) {
    console.log('\n[1/4] Engines:')
    ENGINES.forEach((e, i) => console.log(`  ${i + 1}. ${e.label}${e.id === 'claude' ? '' : ' — beta'}`))
    const a = await ask('Numbers, comma-separated [1]: ')
    engines = (a.trim() || '1').split(/[\s,]+/).map((x) => (ENGINES[Number(x) - 1] || {}).id || x).join(',')
  }
  engines = (engines || 'claude').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
  for (const e of engines) if (!ENGINES.some((x) => x.id === e)) { console.error(`Unknown engine: ${e}`); process.exit(2) }
  return engines
}

// step 2: template — by flag, from the menu, or none; an unknown one exits with 2
async function chooseTemplate(o, ask, templates) {
  let template = o.template
  if (!template && ask) {
    console.log('\n[2/4] Project template:')
    console.log('  0. no template — the route is worked out in the interview (default)')
    templates.forEach((t, i) => console.log(`  ${i + 1}. ${t.name}${t.title ? ' — ' + t.title : ''}`))
    const a = (await ask('Number [0]: ')).trim()
    template = !a || a === '0' ? 'none' : ((templates[Number(a) - 1] || {}).name || a)
  }
  template = template || 'none'
  if (template !== 'none' && !templates.some((t) => t.name === template)) { console.error(`No such template: ${template}. Available: ${templates.map((t) => t.name).join(', ') || '—'}`); process.exit(2) }
  return template
}

// step 3: board — by flag, from the menu, or auto
async function chooseBoard(o, ask) {
  let boardMode = o.board
  if (!boardMode && ask) {
    console.log('\n[3/4] Kanban board — the Kanban Markdown editor extension:')
    const a = (await ask('Find editors and install it? [Y/n]: ')).trim().toLowerCase()
    boardMode = a === 'n' || a === 'н' || a === 'no' ? 'skip' : 'auto'
  }
  return boardMode || 'auto'
}

// step 4: project document language — by flag, from the menu, or en. A language with a message catalog
// (core/i18n/messages/<code>.json) gets hook output in it; any other code is accepted: the agent translates the scaffold
// (keeping the anchors), the hooks print English.
const MESSAGES = path.join(CORE, 'i18n', 'messages')
const catalogLangs = () => fs.readdirSync(MESSAGES).filter((n) => /^[a-z]{2,3}\.json$/.test(n)).map((n) => n.slice(0, -5)).sort((x, y) => (x === 'en' ? -1 : y === 'en' ? 1 : x.localeCompare(y)))
// the name written into PROJECT.md: the English name of a known language, else the code itself
const langName = (code) => { const n = (i18n.KEYS.languages[code] || [])[0]; return n ? n[0].toUpperCase() + n.slice(1) : code }
async function chooseLang(o, ask) {
  const known = catalogLangs()
  let lang = o.lang
  if (!lang && ask) {
    console.log('\n[4/4] Project document language:')
    known.forEach((id, i) => console.log(`  ${i + 1}. ${langName(id)}${id === 'en' ? ' (default)' : ' — the agent translates the scaffold after install'}`))
    console.log('  or type another language code (fr, de, ...): the agent translates the scaffold, hook messages stay English')
    const a = (await ask('Number or code [1]: ')).trim()
    lang = !a ? 'en' : (known[Number(a) - 1] || a)
  }
  lang = String(lang || 'en').toLowerCase()
  if (!/^[a-z]{2,3}$/.test(lang)) { console.error(`Language not supported: ${lang}. Use a language code such as ${known.join(', ')}, fr, de`); process.exit(2) }
  return lang
}

// Project language: a field in PROJECT.md and, for non-English, a "translation pending" marker — the agent translates, not the installer.
function applyLanguage(root, lang) {
  const f = projectFile(root, 'PROJECT.md')
  let t = fs.readFileSync(f, 'utf8')
  t = t.replace(/(\*\*Project language\*\*[^\n]*?\)\*?:\s*)English\./, `$1${langName(lang)}.`)
  fs.writeFileSync(f, t)
  if (lang === 'en') return null
  const files = []
  for (const rel of walk(path.join(root, 'project'), { symlinks: true })) {
    if (/\.md$/.test(rel) && !rel.startsWith('brief' + path.sep + 'answers')) files.push('project/' + rel.split(path.sep).join('/'))
  }
  const marker = path.join(root, '.forma', 'translation-pending.json')
  fs.mkdirSync(path.dirname(marker), { recursive: true })
  fs.writeFileSync(marker, JSON.stringify({ from: 'en', to: lang, files: files.sort() }, null, 2) + '\n')
  return files.length
}

// A PROJECT.md written without anchors (older project) gets them added: parsers then read it by key, in any language.
function migrateAnchors(root) {
  const f = projectFile(root, 'PROJECT.md')
  if (!fs.existsSync(f)) return 'PROJECT.md anchors: no PROJECT.md'
  const before = fs.readFileSync(f, 'utf8')
  const after = i18n.anchorise(before)
  if (after === before) return 'PROJECT.md anchors: already in place'
  fs.writeFileSync(f, after)
  return 'PROJECT.md anchors: added (invisible keys, labels untouched)'
}

// Paths the project template already wrote per project/config/PROJECT.md: the core does not overwrite them.
function protectedTemplatePaths(root, existingTemplate) {
  const protectedPaths = new Set()
  if (existingTemplate && fs.existsSync(path.join(TEMPLATES, existingTemplate))) {
    for (const [, rel] of templateFiles(existingTemplate)) protectedPaths.add(path.resolve(root, rel))
  }
  return protectedPaths
}

// Codex (beta): .codex/ and the .agents/skills mirror from the adapter; the project config.toml is not overwritten (it holds the project MCP);
// then sync-codex --apply rebuilds roles and the mirror from .claude/ (Claude Code must be installed).
function installCodex(root, protectedPaths) {
  const A = path.join(ADAPTERS, 'codex')
  const skip = (d) => protectedPaths.has(path.resolve(d))
  const cfg = path.join(root, '.codex', 'config.toml')
  const hadCfg = fs.existsSync(cfg)
  copyTree(path.join(A, '.codex'), path.join(root, '.codex'), { skip: (d) => skip(d) || (hadCfg && path.resolve(d) === path.resolve(cfg)) })
  copyTree(path.join(A, '.agents', 'skills'), path.join(root, '.agents', 'skills'), { skip })
  const out = ['Codex (beta): .codex/ (roles, agents, hooks, tests, §8) and .agents/skills — installed' + (hadCfg ? '; project config.toml kept' : '')]
  const sync = path.join(root, '.codex', 'scripts', 'sync-codex.cjs')
  if (!fs.existsSync(path.join(root, '.claude', 'agents'))) {
    out.push('  ! .claude/agents not found — install Claude Code (--engines claude,codex), then: node .codex/scripts/sync-codex.cjs --apply --plugin <skills/forma>')
  } else {
    const r = require('child_process').spawnSync(process.execPath, [sync, '--apply', '--root', root, '--plugin', SKILL], { encoding: 'utf8' })
    out.push(r.status === 0 ? '  sync-codex --apply: roles and skills mirror built' : '  ! sync-codex --apply exited with code ' + r.status + ': ' + ((r.stdout || '') + (r.stderr || '')).trim().split(/\r?\n/).slice(-3).join(' | '))
  }
  return out
}

// Gemini (beta, Antigravity): §8 wrapper, plugin, node roles; mcp_config.json is an empty stub, an existing one is not touched.
function installGemini(root) {
  const A = path.join(ADAPTERS, 'gemini')
  const P = path.join(root, '.agents', 'plugins', 'forma')
  copyTree(path.join(A, 'rules'), path.join(root, '.agents', 'rules'))
  copyFile(path.join(A, 'forma-adapter.cjs'), path.join(root, '.agents', 'forma-adapter.cjs'))
  copyFile(path.join(A, 'plugin.json'), path.join(P, 'plugin.json'))
  copyTree(path.join(A, 'agents'), path.join(P, 'agents'))
  copyFile(path.join(A, 'mcp_config.json'), path.join(P, 'mcp_config.json'), { overwrite: false })
  return ['Gemini (Antigravity, beta): .agents/rules, .agents/plugins/forma (roles, plugin.json) — installed']
}

function installEngines(root, engines, protectedPaths, report) {
  for (const e of engines) {
    if (e === 'claude') {
      const warn = installClaude(root, protectedPaths)
      report.push('Claude Code: .claude/rules, agents, hooks, scripts, skills, settings.json (hooks) — synced')
      if (warn) report.push('  ! ' + warn)
    } else if (e === 'codex') {
      report.push(...installCodex(root, protectedPaths))
    } else if (e === 'gemini') {
      report.push(...installGemini(root))
    }
  }
}

function installTemplateStep({ root, template, existingTemplate }, core, report) {
  if (template === 'none') {
    report.push(`template: ${existingTemplate ? `kept the recorded «${existingTemplate}» (the core does not overwrite its files)` : 'none (project/config/PROJECT.md, "Project template" — can be changed any time)'}`)
  } else if (existingTemplate && existingTemplate !== template) {
    report.push(`template: project/config/PROJECT.md already records «${existingTemplate}» — not installing «${template}», project/ untouched`)
  } else {
    const t = installTemplate(root, template, core.projectCreated)
    report.push(`template ${template}: written ${t.written}, left as is ${t.kept}${core.projectCreated ? '' : ' (project/ already existed — its template files are untouched)'}`)
  }
}

// Install manifest: what the installer wrote and what must be wired for each ready engine.
function claudeExpect() {
  const hooks = []
  for (const [event, groups] of Object.entries(CLAUDE_HOOKS)) {
    for (const g of groups) for (const h of g.hooks) {
      const [name, timeout] = Array.isArray(h) ? h : [h]
      hooks.push({ event, matcher: g.matcher || '', name, ...(timeout ? { timeout } : {}) })
    }
  }
  return { hooks }
}
function writeManifest(root, { engines, lang, template, projectCreated }) {
  let previous = null
  try { previous = verifyInstall.readManifest(root) } catch { /* a broken earlier manifest is recreated */ }
  const rows = engines.map((id) => (id === 'claude'
    ? { id, profile: '.claude/verify-profile.cjs', expect: claudeExpect() }
    : { id, note: 'beta — no verify profile yet' }))
  const manifest = verifyInstall.buildManifest(root, { owned, projectCreated, previous, engines: rows, lang, version: VERSION, template })
  const f = path.join(root, verifyInstall.MANIFEST)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, JSON.stringify(manifest, null, 2) + '\n')
}

// Install integrity check: red on the main engine stops; secondary engines only warn.
function printVerify(root) {
  const res = verifyInstall.verify(root)
  console.log('Install integrity (node .forma/verify/verify-install.cjs): ' + verifyInstall.format(res))
  return res.ok
}

// install: core, engines, template, board; returns the report lines and the board result
function install(root, choice) {
  const migrationLine = [migrateLayout(root), migrateConfig(root), migrateOps(root), migrateAnchors(root)].join('\n')
  const existingTemplate = readProjectTemplate(root)
  const protectedPaths = protectedTemplatePaths(root, existingTemplate)
  const core = installCore(root, protectedPaths)
  const report = []
  report.push(migrationLine)
  report.push(`core: AGENTS.md, .forma/manual/, .forma/board/, .forma/skills/, .forma/dashboard/ synced; .forma/living/ — missing files added; board .devtool/features/ — ${core.boardState}; project/ — ${core.projectState}`)
  installEngines(root, choice.engines, protectedPaths, report)
  installTemplateStep({ root, template: choice.template, existingTemplate }, core, report)
  if (core.projectCreated) {
    const n = applyLanguage(root, choice.lang)
    report.push(n === null ? 'document language: English' : `document language: ${langName(choice.lang)} — translation awaits the agent: ${n} files (.forma/translation-pending.json; step in SKILL.md "Scaffold translation")${catalogLangs().includes(choice.lang) ? '' : `; no message catalog for "${choice.lang}": hook messages stay English (add core/i18n/messages/${choice.lang}.json)`}`)
  } else if (choice.lang !== 'en') report.push('language: project/ already existed — not translated (language is chosen on first install only)')
  writeManifest(root, { engines: choice.engines, lang: choice.lang, template: choice.template === 'none' ? (existingTemplate || 'none') : choice.template, projectCreated: core.projectCreated })
  return { report, boardLines: board(choice.boardMode) }
}

function printReport({ report, boardLines }) {
  console.log('\nSummary:')
  for (const l of report) console.log('  ' + l)
  console.log(`  files written ${stats.written}, kept ${stats.kept}`)
  console.log('Kanban Markdown:')
  for (const l of boardLines) console.log('  ' + l)
}

// ---------- main ----------
async function main() {
  const o = parseArgs(process.argv.slice(2))
  if (o.help || o.cmd === 'help') { process.stdout.write(HELP); return }
  if (o.version || o.cmd === 'version') { console.log(VERSION); return }
  if (o.cmd !== 'init') { console.error(`Unknown command: ${o.cmd}\n\n${HELP}`); process.exit(2) }
  const root = o.dir
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true })
  const templates = listTemplates()
  const interactive = !o.yes && process.stdin.isTTY !== false && !(o.engines && o.template && o.board && o.lang)
  const menu = interactive && (!o.engines || !o.template || !o.board || !o.lang)
  const ask = menu ? makeAsk() : null
  const installedBefore = fs.existsSync(path.join(root, 'AGENTS.md'))

  console.log(`Forma ${VERSION} → ${root}${installedBefore ? ' (update)' : ''}`)
  console.log(`Git: ${gitBoundary(root)}`)

  const engines = await chooseEngines(o, ask)
  const template = await chooseTemplate(o, ask, templates)
  const boardMode = await chooseBoard(o, ask)
  const lang = await chooseLang(o, ask)
  if (ask) ask.close()

  console.log('Installing…')
  const result = install(root, { engines, template, boardMode, lang })
  progressDone()
  printReport(result)
  const ok = printVerify(root)
  if (!ok) { console.error('\nInstall is broken — fix the items above and rerun (rerunning is safe).'); process.exit(1) }
  if (!installedBefore) console.log('\nNext: open the folder in Claude Code — Intent will lead the setup per project/config/SETUP.md, starting with the interview.')
}

main().catch((e) => { console.error(e.message || e); process.exit(1) })
