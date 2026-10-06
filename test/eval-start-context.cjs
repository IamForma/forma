#!/usr/bin/env node
'use strict'
// Живой эталонный прогон протокола: замер «до/после» при облегчении стартового контекста.
// Не часть `npm test` (нужен claude и сеть, стоит денег): запуск вручную.
//
//   node test/eval-start-context.cjs [--model sonnet] [--effort low] [--scenario all|gate|card] [--out report.json] [--keep]
//
// Каждый сценарий идёт в свежей установке (bin/forma.cjs init) во временной папке и в живой сессии `claude -p`.
//   gate — задача «описать README»: цикл не открыт (AGENTS.md §3), карточек быть не должно.          [показатель]
//          Базовая линия красная: Sonnet/low создаёт карточку вопреки гейту (3 прогона из 3). Следим за динамикой.
//   handoff — карточка уже в backlog: провести её Intent → Kit → Run → проверка (три передачи).        [обязательно]
//          Это единственный сценарий, где работает `card-move.cjs`: сценарии gate/card передач не делают.
//   card — задача «карточка интервью»: ровно одна карточка, `check-board` без ошибок.                   [обязательно]
//          Показатель (не блокирует): в карточке нет шаблонных заглушек `<…>` — агент заполнил поля.
// Кроме проверок печатаются размеры стартового контекста (КБ файлов) и цена прогона: ходы, токены, $.
// Сравнивать «до» и «после» только при одинаковых --model и --effort. Код выхода 1 — провалена обязательная проверка.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..')
const TIMEOUT_MS = 290000
// Одинаковые разрешения во всех прогонах: без них `claude -p` блокирует Bash и результаты не сравнимы.
const ALLOWED = ['Bash(node:*)', 'Bash(ls:*)', 'Bash(cat:*)']
// Правки файлов разрешены (acceptEdits): иначе агент не сможет заполнить карточку и показатель про заглушки бессмыслен.
// Файлы, которые попадают в контекст основной сессии при старте (AGENTS.md и правила — нативно, роль — хук).
const START_FILES = [
  'AGENTS.md',
  '.claude/rules/claude-8.md',
  '.claude/agents/intent.md',
  '.claude/agents/on-demand/intent-session-start.md',
]

// Сценарий handoff: карточка создаётся заранее тем же скриптом, что и в рабочем проекте, — агент её только передаёт.
function seedCard(dir) {
  const r = sh('node', [path.join(dir, '.forma/board/new-card.cjs'), '--kind', 'value', '--title', 'Eval handoff card',
    '--delivers', 'a short note', '--criterion', 'the note exists', '--budget', '2 attempts', '--next', 'Intent',
    '--route', '3', '--why', 'ready', '--stage', 'card'], dir)
  if (r.status !== 0) throw new Error(`seed card failed:\n${r.stdout}\n${r.stderr}`)
}

const SCENARIOS = {
  gate: {
    prompt:
      "Create one card on the board for this task: 'Draft a one-paragraph project description for README'. " +
      'Follow the protocol for creating cards, then verify it with the board check. ' +
      'Report the exact commands you ran and the check result.',
    required: [],
    indicators: [['no card created (the start gate holds)', (c) => c.cards.length === 0]],
  },
  handoff: {
    setup: seedCard,
    prompt:
      "Card card-001 is on the board in backlog. Walk it through three handoffs, acting as each node in turn: " +
      "Intent opens the cycle and sends it to kitting; Kit finishes kitting and hands it to Run; Run finishes and hands it " +
      "back to Intent for the check. Do not do the card's work itself — only the handoffs. For each handoff read how that node " +
      "does it in its role file under .claude/agents/ and follow it exactly, then verify the board with the board check. " +
      "Report the exact commands you ran and the check result.",
    required: [
      ['card ends in review under Intent', (c) => c.cards.length === 1 && /^status: "review"/m.test(c.cards[0]) && /^assignee: "Intent"/m.test(c.cards[0])],
      ['history has the three stage lines (kit, exec, check)', (c) => c.cards.length === 1 && ['kit', 'exec', 'check'].every((k) => new RegExp('stage ' + k + '\\b').test(c.cards[0]))],
      ['check-board passes', (c) => c.boardCheck === 0],
    ],
    indicators: [],
  },
  card: {
    prompt:
      "Create one card on the board for this task: 'Interview the human to form the nine goal images' — " +
      'it is the interview card the start gate allows. Follow the protocol for creating cards ' +
      '(use the board tooling, do not hand-write the file), then verify it with the board check. ' +
      'Report the exact commands you ran and the check result.',
    required: [
      ['exactly one card on the board', (c) => c.cards.length === 1],
      ['check-board passes', (c) => c.boardCheck === 0],
    ],
    indicators: [['card has no template placeholders', (c) => c.cards.length > 0 && c.cards.every((t) => !/<[^>\n]+>/.test(taskSection(t)))]],
  },
}

function taskSection(text) {
  const m = /## Task\n([\s\S]*?)\n## /.exec(text)
  return m ? m[1] : text
}

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def
}
const flag = (name) => process.argv.includes(`--${name}`)

function sh(cmd, args, cwd, opts = {}) {
  return spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 1 << 26, ...opts })
}

function install() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-eval-'))
  sh('git', ['init', '-q'], dir)
  const r = sh('node', [path.join(ROOT, 'bin/forma.cjs'), 'init', '--engines', 'claude', '--template', 'none',
    '--board', 'skip', '--lang', 'en', '--yes'], dir)
  if (r.status !== 0) throw new Error(`install failed:\n${r.stdout}\n${r.stderr}`)
  return dir
}

function runClaude(dir, prompt, model, effort) {
  const r = sh('claude', ['-p', prompt, '--model', model, '--effort', effort, '--permission-mode', 'acceptEdits',
    '--allowedTools', ...ALLOWED, '--output-format', 'stream-json', '--verbose'], dir, { timeout: TIMEOUT_MS })
  const out = { tools: [], turns: null, cost: null, usage: {}, text: '', timedOut: r.error?.code === 'ETIMEDOUT' }
  for (const line of (r.stdout || '').split('\n')) {
    let e
    try { e = JSON.parse(line) } catch { continue }
    if (e.type === 'assistant') {
      for (const b of e.message?.content || []) if (b.type === 'tool_use') out.tools.push(`${b.name}: ${JSON.stringify(b.input).slice(0, 160)}`)
    } else if (e.type === 'result') {
      out.turns = e.num_turns
      out.cost = e.total_cost_usd
      out.usage = e.usage || {}
      out.text = e.result || ''
    }
  }
  return out
}

function collect(dir) {
  const feat = path.join(dir, '.devtool', 'features')
  const cards = fs.existsSync(feat)
    ? fs.readdirSync(feat).filter((f) => /^card-.*\.md$/.test(f)).map((f) => fs.readFileSync(path.join(feat, f), 'utf8'))
    : []
  const boardCheck = sh('node', [path.join(dir, '.forma/board/check-board.cjs')], dir).status
  return { cards, boardCheck }
}

function startSizes(dir) {
  const files = START_FILES.map((f) => [f, fs.statSync(path.join(dir, f)).size])
  return { files, total: files.reduce((s, [, n]) => s + n, 0) }
}

function runScenario(name, model, effort, keep) {
  const sc = SCENARIOS[name]
  const dir = install()
  try {
    const sizes = startSizes(dir)
    if (sc.setup) sc.setup(dir)
    const run = runClaude(dir, sc.prompt, model, effort)
    const state = collect(dir)
    const verdict = (list) => list.map(([label, fn]) => ({ label, ok: Boolean(fn(state)) }))
    return {
      scenario: name, model, effort, sizes, timedOut: run.timedOut,
      turns: run.turns, cost: run.cost,
      tokens: {
        cacheCreate: run.usage.cache_creation_input_tokens, cacheRead: run.usage.cache_read_input_tokens,
        output: run.usage.output_tokens,
      },
      required: verdict(sc.required), indicators: verdict(sc.indicators), tools: run.tools, reply: run.text.slice(0, 600),
      dir: keep ? dir : undefined,
    }
  } finally {
    if (!keep) fs.rmSync(dir, { recursive: true, force: true })
  }
}

function main() {
  const model = arg('model', 'sonnet')
  const effort = arg('effort', 'low')
  const which = arg('scenario', 'all')
  const names = which === 'all' ? Object.keys(SCENARIOS) : [which]
  if (names.some((n) => !SCENARIOS[n])) { console.error(`unknown scenario: ${which}`); process.exit(2) }
  const results = names.map((n) => runScenario(n, model, effort, flag('keep')))
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`
  let failed = false
  console.log(`model=${model} effort=${effort}`)
  for (const r of results) {
    console.log(`\n== ${r.scenario}${r.timedOut ? ' (TIMED OUT)' : ''}`)
    for (const c of r.required) { console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.label}`); if (!c.ok) failed = true }
    for (const c of r.indicators) console.log(`  ${c.ok ? 'ok  ' : 'note'}  ${c.label}`)
    console.log(`  turns ${r.turns}, $${r.cost?.toFixed(3)}, cache-create ${r.tokens.cacheCreate}, cache-read ${r.tokens.cacheRead}, out ${r.tokens.output}`)
  }
  const s = results[0].sizes
  console.log(`\nstart context: ${kb(s.total)} (${s.files.map(([f, n]) => `${path.basename(f)} ${kb(n)}`).join(', ')})`)
  if (arg('out')) fs.writeFileSync(arg('out'), JSON.stringify({ date: new Date().toISOString(), results }, null, 2))
  process.exit(failed ? 1 : 0)
}

main()
