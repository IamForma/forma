#!/usr/bin/env node
'use strict'
// Установщик протокола «Форма»: `npx github:IamForma/forma init`.
// Node без зависимостей. Ставит ядро всегда, затем три шага: движки, шаблон проекта, Kanban Markdown.
// Повторный запуск = обновление: конфигурация схемы перезаписывается, `project/`, доска и `.forma/living/` не трогаются.

const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline')
const { spawnSync } = require('node:child_process')
const { walk, projectFile } = require('../skills/forma/core/dashboard/lib/fs.cjs')
const { parseLong } = require('../skills/forma/core/dashboard/lib/cli.cjs')
const verifyInstall = require('../skills/forma/core/verify/verify-install.cjs')

const PKG = path.resolve(__dirname, '..')
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

// ---------- аргументы ----------
function parseArgs(argv) {
  const { opts, rest } = parseLong(argv, ['help', 'yes'])
  const o = { cmd: 'init', dir: process.cwd(), ...opts }
  if (rest[0]) o.cmd = rest[0]
  o.dir = path.resolve(o.dir)
  return o
}

const HELP = `forma init — установка/обновление протокола «Форма» в текущую папку

  npx github:IamForma/forma init [флаги]

  --engines  claude[,codex,gemini]   движки (codex, gemini — бета (в разработке))
  --template <имя>|none              шаблон проекта из templates/ (по умолчанию none)
  --board    auto|skip               Kanban Markdown: найти CLI редакторов и поставить (по умолчанию auto)
  --lang     en|ru                   язык документов проекта (по умолчанию en; ru — перевод каркаса агентом после установки)
  --dir      <путь>                  корень проекта (по умолчанию текущая папка)
  --yes                              без вопросов, недостающее — по умолчанию

Все четыре флага заданы (или --yes, или нет терминала) — меню не показывается.
`

// ---------- ввод ----------
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

// ---------- файлы ----------
const stats = { written: 0, kept: 0 }
const owned = new Set() // файлы, записанные установщиком в этот проход: из них строится опись установки
function copyFile(src, dst, { overwrite = true } = {}) {
  if (fs.existsSync(dst) && !overwrite) { stats.kept++; return false }
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.copyFileSync(src, dst)
  stats.written++
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

// ---------- шаг 0: Git ----------
function gitBoundary(root) {
  const r = spawnSync(process.execPath, [path.join(PKG, 'scripts', 'initialize-project-git.cjs'), root], { encoding: 'utf8' })
  if (r.status !== 0) {
    process.stderr.write(r.stderr || r.stdout)
    process.exit(1)
  }
  return r.stdout.trim()
}

// ---------- миграция со старой раскладки ----------
// Проект, установленный до v0.4.182 (`board/`, `dashboard/`, `living/`, `manual/`, `skills/`,
// `templates/`, `protocol/` в корне) — набор layout-* переносит их в `.forma/` и правит
// текстовые ссылки. `project/` и `.devtool/` — зона человека, их содержимое не читает та же логика
// переезда ничего не трогает (`--exclude`).
const LAYOUT = path.join(PKG, 'scripts', 'layout')
const LAYOUT_MAP = path.join(LAYOUT, 'layout-map.json')

function oldLayoutMoves(root) {
  if (!fs.existsSync(LAYOUT_MAP)) return []
  const { moves } = JSON.parse(fs.readFileSync(LAYOUT_MAP, 'utf8'))
  return moves.filter((m) => fs.existsSync(path.join(root, m.from)) && !fs.existsSync(path.join(root, m.to)))
}

// Файл под перенесённым каталогом, которого нет в эталоне ядра/шаблонов — положен человеком
// в старую раскладку самостоятельно; переезжает вместе с каталогом (git mv), здесь — только для
// отчёта. `protocol/` своего эталона внутри PKG не имеет — пропускается.
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
  if (!moved.length) return 'перенос со старой раскладки: не требуется (ничего не изменено)'
  const r = spawnSync(process.execPath, [
    path.join(LAYOUT, 'layout-rewrite.cjs'), '--map', LAYOUT_MAP, '--root', root, '--apply',
    '--exclude', 'project/', '--exclude', '.devtool/',
  ], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error('СТОП: перенос со старой раскладки упал:\n' + (r.stdout || '') + (r.stderr || ''))
  const extra = userFilesAfterMove(root, moved)
  const lines = ['перенос со старой раскладки: ' + r.stdout.trim().split('\n')[0]]
  if (extra.length) lines.push('  файлы пользователя сохранены: ' + extra.join(', '))
  return lines.join('\n')
}

// Статичные конфиги проекта (`PROJECT.md`, `CONFIG.md`, `SETUP.md`, `ROUTE.md`, `SITE.md`) лежали в `project/`;
// теперь — в `project/config/`. Те же layout-*: переносит файлы и правит точные пути в тексте
// (история — карточки, `JOURNAL`/`CHANGELOG`, чужие движки — в исключениях карты).
const CONFIG_MAP = path.join(LAYOUT, 'layout-config-map.json')

function migrateMap(root, mapFile, label) {
  const { moves } = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
  const pending = moves.filter((m) => fs.existsSync(path.join(root, m.from)) && !fs.existsSync(path.join(root, m.to)))
  if (!pending.length) return `перенос ${label}: не требуется (ничего не изменено)`
  const r = spawnSync(process.execPath, [path.join(LAYOUT, 'layout-rewrite.cjs'), '--map', mapFile, '--root', root, '--apply'], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`СТОП: перенос ${label} упал:\n` + (r.stdout || '') + (r.stderr || ''))
  return `перенос ${label}: ` + pending.map((m) => path.basename(m.from)).join(', ') + '. ' + r.stdout.trim().split('\n')[0]
}
const migrateConfig = (root) => migrateMap(root, CONFIG_MAP, 'конфигурации в project/config/')
const OPS_MAP = path.join(LAYOUT, 'layout-ops-map.json')
const migrateOps = (root) => migrateMap(root, OPS_MAP, 'служебных файлов в project/ops/')

// ---------- ядро ----------
function installCore(root, protectedPaths) {
  const skip = (d) => protectedPaths.has(path.resolve(d))
  const forma = path.join(root, '.forma')
  copyFile(path.join(CORE, 'AGENTS.md'), path.join(root, 'AGENTS.md'))
  copyTree(path.join(CORE, 'manual'), path.join(forma, 'manual'))
  copyTree(path.join(CORE, 'board'), path.join(forma, 'board'))
  copyTree(path.join(CORE, 'verify'), path.join(forma, 'verify'))
  copyTree(path.join(CORE, 'skills'), path.join(forma, 'skills'), { skip })
  // дашборд: код перезаписывается, настройки человека — нет
  copyTree(path.join(CORE, 'dashboard'), path.join(forma, 'dashboard'), {
    skip: (d) => /graphify\.config\.json$/.test(d) && fs.existsSync(d),
  })
  // живое — только довезти недостающее
  copyTree(path.join(CORE, 'living'), path.join(forma, 'living'), { overwrite: false })
  const features = path.join(root, '.devtool', 'features')
  const boardState = fs.existsSync(features) ? 'стояла, не тронута' : 'создана'
  if (!fs.existsSync(features)) copyTree(path.join(CORE, '.devtool', 'features'), features)
  // project/ — только на первой установке
  const projectDir = path.join(root, 'project')
  let projectState = 'уже был, не тронут'
  if (!fs.existsSync(projectDir)) {
    copyTree(path.join(CORE, 'project'), projectDir)
    projectState = 'создан каркас'
  }
  ensureLine(path.join(root, '.gitignore'), '.forma/dashboard/.cache/', 'Forma: рантайм дашборда')
  return { boardState, projectState, projectCreated: projectState === 'создан каркас' }
}

// ---------- адаптер Claude ----------
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
    try { s = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { throw new Error(`.claude/settings.json не читается как JSON — поправьте вручную и повторите`) }
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
  copyFile(path.join(A, 'forma-adapter.cjs'), path.join(C, 'forma-adapter.cjs')) // граница ядро — адаптер: ядро находит его по имени файла
  copyFile(path.join(A, 'verify-profile.cjs'), path.join(C, 'verify-profile.cjs')) // профиль сверки установки: ядро находит его по описи
  copyTree(path.join(A, 'rules'), path.join(C, 'rules'))
  copyTree(path.join(A, 'agents'), path.join(C, 'agents'))
  copyTree(path.join(A, 'hooks'), path.join(C, 'hooks'))
  for (const f of fs.readdirSync(path.join(C, 'hooks'))) {
    if (f.endsWith('.sh')) try { fs.chmodSync(path.join(C, 'hooks', f), 0o755) } catch { /* права на исполнение не ставятся на ФС без chmod (Windows) — хук запустит bash */ }
  }
  copyTree(path.join(A, 'scripts'), path.join(C, 'scripts'), { skip })
  copyTree(path.join(A, 'skills'), path.join(C, 'skills'), { skip })
  // доставка интервью из ядра — копией без правок
  copyTree(path.join(CORE, 'skills'), path.join(C, 'skills'), { skip })
  copyTree(path.join(A, 'dashboard'), path.join(root, '.forma', 'dashboard'))
  mergeClaudeSettings(root)
  const rootClaude = path.join(root, 'CLAUDE.md')
  return fs.existsSync(rootClaude)
    ? 'в корне найден CLAUDE.md — он затеняет чтение AGENTS.md; перенесите уникальное в .claude/rules/claude-8.md и удалите'
    : null
}

// ---------- шаблоны ----------
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
  const m = fs.readFileSync(f, 'utf8').match(/\|\s*(?:Имя|Name)\s*\|\s*`?([^|`]+?)`?\s*\|/)
  const name = m && m[1].trim()
  return name && name !== '—' && name !== 'нет' && name !== 'none' ? name : null
}
function templateFiles(name) {
  // что шаблон кладёт в проект: [источник, путь в проекте]
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
    const ru = /\|\s*Имя\s*\|/.test(t)
    t = t.replace(/(\|\s*(?:Имя|Name)\s*\|)\s*—\s*\|/, `$1 \`${name}\` |`)
      .replace(/(\|\s*(?:Источник|Source)\s*\|)\s*—\s*\|/, `$1 ${ru ? 'плагин forma' : 'forma plugin'}, \`templates/${name}\` |`)
      .replace(/(\|\s*(?:Статус|Status)\s*\|)\s*`(?:нет|none)`\s*\|/, `$1 \`${ru ? 'формируется с человеком' : 'forming with the human'}\` |`)
    fs.writeFileSync(f, t)
  }
  return { written, kept }
}

// ---------- Kanban Markdown ----------
function runCli(cli, args) {
  const extra = process.env.FORMA_EXTENSIONS_DIR ? ['--extensions-dir', process.env.FORMA_EXTENSIONS_DIR] : []
  const win = process.platform === 'win32'
  const all = [...extra, ...args]
  // Windows: CLI редакторов — .cmd-обёртки, запускаются только через оболочку; аргументы — наши константы и путь в кавычках
  return win
    ? spawnSync([cli, ...all.map((a) => (/\s/.test(a) ? `"${a}"` : a))].join(' '), { encoding: 'utf8', shell: true, timeout: 180000 })
    : spawnSync(cli, all, { encoding: 'utf8', timeout: 180000 })
}
function board(mode) {
  const lines = []
  if (mode === 'skip') return [`пропущено (--board skip); поставьте сами: code --install-extension ${EXT_ID}`]
  let found = 0
  for (const cli of EDITOR_CLIS) {
    const list = runCli(cli, ['--list-extensions'])
    if (list.error || list.status !== 0) continue
    found++
    if (list.stdout.toLowerCase().split(/\r?\n/).includes(EXT_ID.toLowerCase())) { lines.push(`${cli}: ✓ ок`); continue }
    const inst = runCli(cli, ['--install-extension', EXT_ID])
    const again = runCli(cli, ['--list-extensions'])
    if (inst.status === 0 && again.stdout.toLowerCase().includes(EXT_ID.toLowerCase())) lines.push(`${cli}: ✓ установлено`)
    else lines.push(`${cli}: ✗ не удалось — выполните вручную: ${cli} --install-extension ${EXT_ID}`)
  }
  if (!found) lines.push(`CLI редактора не найден (${EDITOR_CLIS.join(', ')}). Поставьте расширение сами: code --install-extension ${EXT_ID} (или из магазина расширений: Kanban Markdown, LachyFS)`)
  return lines
}

/// шаг 1: движки — флагом, из меню или по умолчанию claude; неизвестный — выход 2
async function chooseEngines(o, ask) {
  let engines = o.engines
  if (!engines && ask) {
    console.log('\n[1/4] Движки:')
    ENGINES.forEach((e, i) => console.log(`  ${i + 1}. ${e.label}${e.id === 'claude' ? '' : ' — бета'}`))
    const a = await ask('Номера через запятую [1]: ')
    engines = (a.trim() || '1').split(/[\s,]+/).map((x) => (ENGINES[Number(x) - 1] || {}).id || x).join(',')
  }
  engines = (engines || 'claude').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
  for (const e of engines) if (!ENGINES.some((x) => x.id === e)) { console.error(`Неизвестный движок: ${e}`); process.exit(2) }
  return engines
}

// шаг 2: шаблон — флагом, из меню или none; неизвестный — выход 2
async function chooseTemplate(o, ask, templates) {
  let template = o.template
  if (!template && ask) {
    console.log('\n[2/4] Шаблон проекта:')
    console.log('  0. без шаблона — маршрут вырабатывается в интервью (по умолчанию)')
    templates.forEach((t, i) => console.log(`  ${i + 1}. ${t.name}${t.title ? ' — ' + t.title : ''}`))
    const a = (await ask('Номер [0]: ')).trim()
    template = !a || a === '0' ? 'none' : ((templates[Number(a) - 1] || {}).name || a)
  }
  template = template || 'none'
  if (template !== 'none' && !templates.some((t) => t.name === template)) { console.error(`Нет шаблона: ${template}. Есть: ${templates.map((t) => t.name).join(', ') || '—'}`); process.exit(2) }
  return template
}

// шаг 3: доска — флагом, из меню или auto
async function chooseBoard(o, ask) {
  let boardMode = o.board
  if (!boardMode && ask) {
    console.log('\n[3/4] Канбан-доска — расширение Kanban Markdown в редакторе:')
    const a = (await ask('Найти редакторы и поставить? [Y/n]: ')).trim().toLowerCase()
    boardMode = a === 'n' || a === 'н' || a === 'no' ? 'skip' : 'auto'
  }
  return boardMode || 'auto'
}

// шаг 4: язык документов проекта — флагом, из меню или en; неизвестный — выход 2
const LANGS = [{ id: 'en', label: 'English (по умолчанию)' }, { id: 'ru', label: 'Русский — каркас переведёт агент после установки' }]
async function chooseLang(o, ask) {
  let lang = o.lang
  if (!lang && ask) {
    console.log('\n[4/4] Язык документов проекта:')
    LANGS.forEach((l, i) => console.log(`  ${i + 1}. ${l.label}`))
    const a = (await ask('Номер [1]: ')).trim()
    lang = !a ? 'en' : ((LANGS[Number(a) - 1] || {}).id || a)
  }
  lang = String(lang || 'en').toLowerCase()
  if (!LANGS.some((l) => l.id === lang)) { console.error(`Язык не поддерживается: ${lang}. Есть: ${LANGS.map((l) => l.id).join(', ')}`); process.exit(2) }
  return lang
}

// Язык проекта: поле в PROJECT.md и, для не-английского, метка «перевод ждёт» — перевод делает агент, не установщик.
const LANG_NAMES = { en: 'English', ru: 'Russian' }
function applyLanguage(root, lang) {
  const f = projectFile(root, 'PROJECT.md')
  let t = fs.readFileSync(f, 'utf8')
  t = t.replace(/(\*\*Project language\*\*[^\n]*?\)\*?:\s*)English\./, `$1${LANG_NAMES[lang]}.`)
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

// Пути, которые шаблон проекта уже записал в project/config/PROJECT.md: ядро их не перезаписывает.
function protectedTemplatePaths(root, existingTemplate) {
  const protectedPaths = new Set()
  if (existingTemplate && fs.existsSync(path.join(TEMPLATES, existingTemplate))) {
    for (const [, rel] of templateFiles(existingTemplate)) protectedPaths.add(path.resolve(root, rel))
  }
  return protectedPaths
}

function installEngines(root, engines, protectedPaths, report) {
  for (const e of engines) {
    if (e === 'claude') {
      const warn = installClaude(root, protectedPaths)
      report.push('Claude Code: .claude/rules, agents, hooks, scripts, skills, settings.json (хуки) — синхронизированы')
      if (warn) report.push('  ! ' + warn)
    } else report.push(`${ENGINES.find((x) => x.id === e).label}: бета — адаптер в разработке (adapters/${e}/NOT-READY.md), не ставится`)
  }
}

function installTemplateStep({ root, template, existingTemplate }, core, report) {
  if (template === 'none') {
    report.push(`шаблон: ${existingTemplate ? `оставлен записанный «${existingTemplate}» (его файлы ядро не перезаписывает)` : 'нет (project/config/PROJECT.md, «Шаблон проекта» — меняется в любой момент)'}`)
  } else if (existingTemplate && existingTemplate !== template) {
    report.push(`шаблон: в project/config/PROJECT.md уже записан «${existingTemplate}» — «${template}» не ставлю, project/ не трогается`)
  } else {
    const t = installTemplate(root, template, core.projectCreated)
    report.push(`шаблон ${template}: записано ${t.written}, оставлено как есть ${t.kept}${core.projectCreated ? '' : ' (project/ уже был — его файлы шаблона не трогаются)'}`)
  }
}

// Опись установки: что записал установщик и что должно быть проведено у каждого готового движка.
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
  try { previous = verifyInstall.readManifest(root) } catch { /* битая прежняя опись пересоздаётся */ }
  const rows = engines.map((id) => (id === 'claude'
    ? { id, profile: '.claude/verify-profile.cjs', expect: claudeExpect() }
    : { id, note: 'адаптер не готов — профиль сверки появится вместе с ним' }))
  const manifest = verifyInstall.buildManifest(root, { owned, projectCreated, previous, engines: rows, lang, version: require('../package.json').version, template })
  const f = path.join(root, verifyInstall.MANIFEST)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, JSON.stringify(manifest, null, 2) + '\n')
}

// Сверка целостности установки: главный движок — красное останавливает; второстепенные — предупреждения.
function printVerify(root) {
  const res = verifyInstall.verify(root)
  console.log('Целостность установки (node .forma/verify/verify-install.cjs): ' + verifyInstall.format(res))
  return res.ok
}

// установка: ядро, движки, шаблон, доска; возвращает строки отчёта и итог по доске
function install(root, choice) {
  const migrationLine = [migrateLayout(root), migrateConfig(root), migrateOps(root)].join('\n')
  const existingTemplate = readProjectTemplate(root)
  const protectedPaths = protectedTemplatePaths(root, existingTemplate)
  const core = installCore(root, protectedPaths)
  const report = []
  report.push(migrationLine)
  report.push(`ядро: AGENTS.md, .forma/manual/, .forma/board/, .forma/skills/, .forma/dashboard/ синхронизированы; .forma/living/ — довезено недостающее; доска .devtool/features/ — ${core.boardState}; project/ — ${core.projectState}`)
  installEngines(root, choice.engines, protectedPaths, report)
  installTemplateStep({ root, template: choice.template, existingTemplate }, core, report)
  if (core.projectCreated) {
    const n = applyLanguage(root, choice.lang)
    report.push(n === null ? 'язык документов: English' : `язык документов: ${LANG_NAMES[choice.lang]} — перевод ждёт агента: ${n} файлов (.forma/translation-pending.json; шаг в SKILL.md «Перевод каркаса»)`)
  } else if (choice.lang !== 'en') report.push('язык: project/ уже был — не переводится (язык выбирается только при первой установке)')
  writeManifest(root, { engines: choice.engines, lang: choice.lang, template: choice.template === 'none' ? (existingTemplate || 'none') : choice.template, projectCreated: core.projectCreated })
  return { report, boardLines: board(choice.boardMode) }
}

function printReport({ report, boardLines }) {
  console.log('\nИтог:')
  for (const l of report) console.log('  ' + l)
  console.log(`  файлов записано ${stats.written}, оставлено ${stats.kept}`)
  console.log('Kanban Markdown:')
  for (const l of boardLines) console.log('  ' + l)
}

// ---------- главное ----------
async function main() {
  const o = parseArgs(process.argv.slice(2))
  if (o.help || o.cmd === 'help') { process.stdout.write(HELP); return }
  if (o.cmd !== 'init') { console.error(`Неизвестная команда: ${o.cmd}\n\n${HELP}`); process.exit(2) }
  const root = o.dir
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true })
  const templates = listTemplates()
  const interactive = !o.yes && process.stdin.isTTY !== false && !(o.engines && o.template && o.board && o.lang)
  const menu = interactive && (!o.engines || !o.template || !o.board || !o.lang)
  const ask = menu ? makeAsk() : null
  const installedBefore = fs.existsSync(path.join(root, 'AGENTS.md'))

  console.log(`Форма → ${root}${installedBefore ? ' (обновление)' : ''}`)
  console.log(`Git: ${gitBoundary(root)}`)

  const engines = await chooseEngines(o, ask)
  const template = await chooseTemplate(o, ask, templates)
  const boardMode = await chooseBoard(o, ask)
  const lang = await chooseLang(o, ask)
  if (ask) ask.close()

  printReport(install(root, { engines, template, boardMode, lang }))
  const ok = printVerify(root)
  if (!ok) { console.error('\nУстановка нарушена — исправьте перечисленное и повторите (повторный запуск безопасен).'); process.exit(1) }
  if (!installedBefore) console.log('\nДальше: откройте папку в Claude Code — Intent поведёт подготовку по project/config/SETUP.md, начиная с интервью.')
}

main().catch((e) => { console.error(e.message || e); process.exit(1) })
