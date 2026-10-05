// Минимальная порча фикстуры на каждую проверку реестров (сверка движков и доска).
// Один случай: { name, registry, id, apply(m), expect, combine?, args? }
//   registry — 'board' (board/check-board.cjs) или 'sync' (.claude/scripts/sync-engines.cjs --check);
//   id       — id проверки, что обязана поймать порчу (совпадает с именем её файла);
//   apply(m) — порча через mutator (см. mutate.cjs), откатывается целиком;
//   expect   — RegExp по находкам проверки; expectInfo — по её сведениям (проверки без находок);
//   combine  — false, если случай несовместим с остальными в общем прогоне (по умолчанию входит);
//   args     — аргументы sync-engines для текстового вывода (по умолчанию --check).
// Даты строк расхода — 2031: позже дня вступления любого правила в фикстуре (checks.json — 2030-01-01).

const CARD_1 = '.devtool/features/card-001-nastroit-sborku-primera.md';
const CARD_2 = '.devtool/features/card-002-vopros-po-primeru.md';
const CARD_3 = '.devtool/features/done/card-003-zakrytaya-osnastka.md';
const ID = '`a1b2c3d4e5f60718`';

// Дописать строку в конец зоны «История» карточки.
const history = (line) => (text) => text.replace('\n\n## Результат', `\n${line}\n\n## Результат`);

const CASES = [
  // --- доска (ядро) ---
  { name: 'epics', registry: 'board', id: 'epics',
    apply: (m) => m.edit(CARD_2, (t) => t.replace(/^epic:.*$/m, 'epic: "99. Чужой"')),
    expect: /card-002-vopros-po-primeru\.md: эпик "99\. Чужой" не из девяти видов/ },
  { name: 'route-labels', registry: 'board', id: 'route-labels',
    apply: (m) => m.edit(CARD_1, (t) => t.replace('"route-4"]', '"route-4", "route-9"]')),
    expect: /метка route-9 — нет такого маршрута/ },
  { name: 'route-stage', registry: 'board', id: 'route-stage',
    apply: (m) => m.edit(CARD_1, (t) => t.replace(/^- `Intent`, 2031-01-01: route route-4.*\n/m, '')),
    expect: /card-001-nastroit-sborku-primera\.md: нет строки причины маршрута/ },
  { name: 'route-executor', registry: 'board', id: 'route-executor',
    apply: (m) => m.edit(CARD_1, (t) => t.replace('"route-4"]', '"route-7"]')),
    expect: /card-001-nastroit-sborku-primera\.md: маршрут route-7 ведёт через `Run`, а в истории нет ни одного его захода/ },
  { name: 'status-values', registry: 'board', id: 'status-values',
    apply: (m) => m.edit(CARD_1, (t) => t.replace(/^status:.*$/m, 'status: "in_progress"')),
    expect: /card-001-nastroit-sborku-primera\.md: status "in_progress" — допустимо только backlog\/todo\/in-progress\/review\/done/ },
  { name: 'card-materials', registry: 'board', id: 'card-materials',
    apply: (m) => m.write('project/cards/card-099/note.md', 'сирота\n'),
    expect: /project\/cards\/card-099\/: карточки с таким кодом на доске нет/ },
  { name: 'spend-language', registry: 'board', id: 'spend-language',
    apply: (m) => m.edit(CARD_1, history(`- \`Kit\`, 2031-01-05: заход, 100 токенов (10 кэш-чтение), 5 с, ${ID} — claude-code: проба.`)),
    expect: /ключевая часть строки расхода не по-английски у 1 записей/ },
  { name: 'core-closing', registry: 'board', id: 'core-closing',
    apply: (m) => m.edit(CARD_3, (t) => t.replace('assignee: null', 'assignee: "Core"')),
    expect: /1 карточек приняты человеком, но не закрыты `Core`/ },
  { name: 'attempt-parses', registry: 'board', id: 'attempt-parses',
    apply: (m) => m.edit(CARD_1, history('- `Kit`, 2031-01-05: attempt, много токенов.')),
    expect: /1 записей расхода не разбираются/ },
  { name: 'attempt-format', registry: 'board', id: 'attempt-format',
    apply: (m) => m.edit(CARD_1, history(`- \`Kit\`, 2031-01-05: attempt, 12000 tokens, 40 s, ${ID} — claude-code: проба.`)),
    expect: /строка захода неполна у 1 записей[\s\S]*card-001-nastroit-sborku-primera\.md: Kit 2031-01-05 — нет кэш-чтения/ },
  { name: 'agent-id', registry: 'board', id: 'agent-id',
    apply: (m) => m.edit(CARD_1, history('- `Kit`, 2031-01-05: attempt, 12000 tokens (3000 cache-read), 40 s — claude-code: проба.')),
    expect: /нет опознавателя вызова в 1 строках захода/ },
  { name: 'engine-tag', registry: 'board', id: 'engine-tag',
    apply: (m) => m.edit(CARD_1, history(`- \`Kit\`, 2031-01-05: attempt, 12000 tokens (3000 cache-read), 40 s, ${ID} — проба без метки движка.`)),
    expect: /нет метки движка в 1 строках захода/ },
  { name: 'engine-tag-zero', registry: 'board', id: 'engine-tag',
    apply: (m) => m.edit(CARD_1, history('- `Intent`, 2031-01-05: attempt, 0 tokens, 0 s — claude-code: проба.')),
    expect: /`0 tokens` числом в 1 строках захода/ },

  // --- сверка движков: ядро ---
  { name: 'manual-languages', registry: 'sync', id: 'manual-languages',
    apply: (m) => m.remove('.forma/manual/ru/03-forma/SCHEME.md'),
    expect: /\.forma\/manual\/en\/03-forma\/SCHEME\.md: нет русской копии в \.forma\/manual\/ru\// },
  { name: 'core-integrity-missing', registry: 'sync', id: 'core-integrity', combine: false,
    apply: (m) => m.remove('.forma/board/DATA-MODEL.md'),
    expect: /ядро: нет \.forma\/board\/DATA-MODEL\.md/ },
  { name: 'core-integrity-engine-bound', registry: 'sync', id: 'core-integrity',
    apply: (m) => m.edit('.forma/board/DATA-MODEL.md', (t) => t + '\nЗапускается в Claude Code.\n'),
    expect: /ядро: \.forma\/board\/DATA-MODEL\.md привязан к движку — «Claude Code»/ },
  { name: 'core-integrity-economy-test', registry: 'sync', id: 'core-integrity',
    apply: (m) => m.write('.forma/dashboard/economy.test.cjs', "console.error('сломан нарочно'); process.exit(1);\n"),
    expect: /ядро: \.forma\/dashboard\/economy\.test\.cjs: тест не прошёл \(код 1\) — сломан нарочно/ },

  // --- сверка движков: адаптер Claude ---
  { name: 'root-rules-section', registry: 'sync', id: 'root-rules',
    apply: (m) => m.edit('AGENTS.md', (t) => t.replace('## 3.', '## Три.')),
    expect: /AGENTS\.md: нет раздела ## 3\./ },
  { name: 'root-rules-claude-md', registry: 'sync', id: 'root-rules',
    apply: (m) => m.write('CLAUDE.md', '@AGENTS.md\n'),
    expect: /CLAUDE\.md в корне — упразднён/ },
  { name: 'engine-impersonal', registry: 'sync', id: 'engine-impersonal',
    apply: (m) => m.write('.forma/dashboard/probe.cjs', '// см. card-007\n'),
    expect: /\.forma\/dashboard\/probe\.cjs:1: след проекта в чистой зоне — «card-007»/ },
  { name: 'claude-delivery-copy', registry: 'sync', id: 'claude-delivery',
    apply: (m) => m.edit('.claude/skills/grilling/SKILL.md', (t) => t + '\nправка в копии\n'),
    expect: /адаптер Claude Code: \.claude\/skills\/grilling разошлась с ядром \.forma\/skills\/grilling/ },
  { name: 'claude-delivery-hook', registry: 'sync', id: 'claude-delivery',
    apply: (m) => m.edit('.claude/hooks/check-card.sh', (t) => t.split('node .forma/board/check-board.cjs').join('node .forma/board/other.cjs')),
    expect: /адаптер Claude Code: хук check-card\.sh не вызывает проверку доски ядра \.forma\/board\/check-board\.cjs/ },
  { name: 'adapter-conformance', registry: 'sync', id: 'adapter-conformance',
    apply: (m) => m.write('.claude/scripts/claude-economy.test.cjs', "console.error('сломан нарочно'); process.exit(1);\n"),
    expect: /адаптер Claude Code: \.claude\/scripts\/claude-economy\.test\.cjs: тест не прошёл \(код 1\) — сломан нарочно/ },
  { name: 'codex', registry: 'sync', id: 'codex',
    apply: (m) => m.write('.codex/README.md', 'заглушка\n'),
    expect: null, expectInfo: /Codex \(сведение, не нарушение\): \.codex\/agents\/intent\.toml: нет определения субагента/ },
  // Паритет ролей — не проверка реестра (сведение): порча видна в таблице и в --diff.
  { name: 'role-parity', registry: 'sync', id: null, args: ['--check', '--diff'],
    apply: (m) => m.write('.agents/plugins/forma/agents/core.md', '# другая роль\n'),
    expect: null },
];

module.exports = { CASES, CHECKS_JSON: { 'route-labels': '2030-01-01', 'route-stage': '2030-01-01', 'route-executor': '2030-01-01', 'attempt-format': '2030-01-01',
  'spend-english': '2030-01-01', 'agent-id': '2030-01-01', 'engine-tag': '2030-01-01', 'goal-label': '2030-01-01' } };
