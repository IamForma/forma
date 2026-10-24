#!/usr/bin/env node
'use strict';

/**
 * test-minimax-adapter.cjs — Тест соответствия адаптера MiniMax Code.
 * Проверяет:
 *  1. Наличие и содержание .minimax/rules/minimax-8.md (все девять контрактов, тег minimax:, регламент Plumb);
 *  2. Форму адаптера: ядро находит его по имени файла, каждое поле есть и своего типа, пути существуют;
 *  3. Паритет ролей зоны с каноническими ролями — побайтово, перегенерацией;
 *  4. Вывод строки расхода из записи журнала: разбор общим форматтером, неизвестное — маркером, не нулём;
 *  5. Пробу возможностей: факты, а не самоотчёт; непро provenное — помечено;
 *  6. Чистоту зоны (запрет 16): в зоне нет следов проекта.
 *
 * Запуск:
 *   node .minimax/tests/test-minimax-adapter.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const engines = require('../../.forma/dashboard/lib/engines.cjs');
const { SPEND_TOKENS_OR_UNKNOWN_RE, ENGINE_TAG_RE, toEnglish } = require('../../.forma/dashboard/spend-line.cjs');
const { deriveSpendLineForCall, LEDGER } = require('../scripts/sync-ledger.cjs');
const { probe } = require('../scripts/capabilities.cjs');

let passed = 0;
const it = (name, fn) => { fn(); passed += 1; console.log('ok  ' + name); };

const adapter = () => engines.loadAdapters(root).find((a) => a.dir === '.minimax');

// 1. §8 движка
it('.minimax/rules/minimax-8.md объявляет девять контрактов и тег движка', () => {
  const p = path.join(root, '.minimax', 'rules', 'minimax-8.md');
  assert.ok(fs.existsSync(p), 'minimax-8.md должен существовать');
  const txt = fs.readFileSync(p, 'utf8');
  assert.match(txt, /^#\s*8\.\s*Engine architecture in MiniMax Code/m, 'должен быть заголовок §8');
  assert.match(txt, /minimax:/, 'должен быть указан тег движка');
  assert.match(txt, /plumb-scrub\.cjs/, 'должен быть указан скрипт очистки Plumb');
  for (const c of ['Contract 1', 'Contract 2', 'Contract 3', 'Contract 4', 'Contract 5', 'Contract 6', 'Contract 7', 'Contract 8', 'Contract 9']) {
    assert.ok(txt.includes(c), `в §8 нет ${c}`);
  }
  assert.match(txt, /ENGINE-CONTRACT\.md/, '§8 должен ссылаться на контракт');
});

it('§8 не пересказывает закон: §1–§7 не копируются в файл движка', () => {
  const txt = fs.readFileSync(path.join(root, '.minimax', 'rules', 'minimax-8.md'), 'utf8');
  const law = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  const lawHeadings = law.split(/\r?\n/).filter((l) => /^##\s+\d\./.test(l));
  for (const h of lawHeadings) {
    const title = h.replace(/^##\s*\d+\.\s*/, '').trim();
    assert.ok(!txt.includes('## ' + title), `§8 движка повторяет раздел закона «${title}»`);
  }
});

// 2. Форма адаптера
it('ядро находит адаптер по имени файла, без имени движка', () => {
  const a = adapter();
  assert.ok(a, 'в корне проекта нет .minimax/forma-adapter.cjs, который загружается');
  assert.equal(a.engine, 'minimax-code');
});

it('форма: каждое объявленное поле есть и своего типа, лишних нет', () => {
  const a = adapter();
  assert.deepEqual(engines.validateAdapter(a), []);
  const missing = Object.keys(engines.SHAPE).filter((f) => a[f] == null);
  assert.deepEqual(missing, []);
});

it('пути адаптера — от корня проекта, и они существуют', () => {
  const a = adapter();
  for (const f of ['rolesDir', 'onDemandRolesDir', 'engineRulesFile', 'skillsDir', 'syncScript']) {
    assert.ok(fs.existsSync(engines.resolveRel(root, a[f])), `${f}: ${a[f]} не найден`);
  }
});

it('вес инструкций: по узлам шаг — число; шагов без кэш-чтения нет — null, не 0', () => {
  const a = adapter();
  const w = a.instructionWeight();
  assert.ok(Object.keys(w.byNode).length > 0);
  for (const v of Object.values(w.byNode)) assert.equal(typeof v.perStep, 'number');
  assert.equal(a.stepsFromCacheRead(0, 100), null);
  assert.equal(a.stepsFromCacheRead(1000, 100), 10);
});

it('расход: шаг стенограммы читается в канонические поля, недостающее — null', () => {
  const u = adapter().parseUsage({ input_tokens: 3, cache_read_input_tokens: 7 });
  assert.deepEqual(u, { tokens_in: 3, tokens_out: null, cache_read: 7, cache_write: null });
});

// 3. Паритет ролей
it('роли зоны совпадают с каноническими — перегенерацией, побайтово', () => {
  const r = spawnSync(process.execPath, [path.join(root, '.minimax', 'scripts', 'gen-roles.cjs'), '--check'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''));
});

it('роли узлов и роли по требованию на месте', () => {
  const dir = path.join(root, '.minimax', 'agents');
  for (const n of ['intent', 'spec', 'kit', 'run', 'core', 'extractor']) {
    assert.ok(fs.existsSync(path.join(dir, n + '.md')), `роль ${n} отсутствует`);
  }
  const onDemand = path.join(dir, 'on-demand');
  assert.ok(fs.existsSync(onDemand) && fs.readdirSync(onDemand).some((f) => f.endsWith('.md')), 'роли по требованию отсутствуют');
});

// 4. Строка расхода из журнала
it('строка расхода выводится из записи журнала и разбирается общим форматтером', () => {
  const DAY = ['2000', '01', '02'].join('-');
  const line = deriveSpendLineForCall(
    { timestamp: DAY + 'T10:00:00.000Z', conversationId: 'conv-test-1234567890', input_tokens: 1200, output_tokens: 300, cache_read_tokens: 450, cache_write_tokens: 0, duration_s: 5 },
    'Spec',
    'test-minimax-adapter: разбор'
  );
  const t = toEnglish(line);
  assert.ok(SPEND_TOKENS_OR_UNKNOWN_RE.test(t), 'строка не разбирается общим форматтером: ' + line);
  // N — полный расход вызова, кэш внутри (ECONOMY.md): 1200 + 300 + 450 + 0 = 1950.
  assert.ok(line.includes('`' + 'Spec`, ' + DAY + ': attempt, 1 950 tokens (450 cache-read), 300 out, 5 s,'), 'строка не по форме §3: ' + line);
  assert.match(line, /minimax: /, 'нет метки движка');
});

it('неизвестное в расходе — маркер, а не ноль', () => {
  const DAY = ['2000', '01', '02'].join('-');
  const line = deriveSpendLineForCall({ timestamp: DAY + 'T10:00:00.000Z' }, 'Run', 'test-minimax-adapter: неизвестное');
  assert.match(line, /unknown tokens/, 'неизвестное должно оставаться маркером');
  assert.ok(!/,\s*0 tokens/.test(line), 'ноль числом запрещён');
});

it('путь журнала — тот, что ядро ищет по конвенции', () => {
  const expected = path.join(root, '.minimax', '.ledger', 'calls.jsonl');
  assert.equal(path.resolve(LEDGER), expected, 'журнал должен лежать в .minimax/.ledger/calls.jsonl');
});

// 5. Проба возможностей
it('роль расхода в зоне — моя: тег minimax:, свой журнал, никакого claude-code:', () => {
  const p = path.join(root, '.minimax', 'agents', 'on-demand', 'spend-line.md');
  assert.ok(fs.existsSync(p), 'роль расхода движка отсутствует');
  const txt = fs.readFileSync(p, 'utf8');
  assert.ok(txt.includes('minimax:'), 'роль должна предписывать тег minimax:');
  assert.ok(!txt.includes('claude-code:'), 'роль не должна предписывать чужой тег: его принимает ядро, и попытка уехала бы в счёт другого движка');
  assert.ok(txt.includes('.minimax/.ledger/calls.jsonl'), 'роль должна указывать журнал вызовов зоны');
  assert.ok(txt.includes('.minimax/scripts/sync-ledger.cjs'), 'роль должна указывать скрипт вывода строки');
  assert.ok(txt.includes('unknown'), 'роль должна называть маркер unknown для непрочитанного поля');
});

it('в ролях зоны нет чужого тега движка', () => {
  // Чужой тег в роли — не опечатка, а ошибка счёта: ядро принимает `claude-code:`, `codex:`,
  // `gemini:`, и попытка MiniMax, написанная по чужому шаблону, уехала бы в счёт другого
  // движка молча.
  const walk = (dir) => {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...walk(p));
      else if (e.name.endsWith('.md')) out.push(p);
    }
    return out;
  };
  const foreign = /(claude-code|codex|gemini):/;
  for (const f of walk(path.join(root, '.minimax', 'agents'))) {
    const txt = fs.readFileSync(f, 'utf8');
    const m = txt.match(foreign);
    assert.ok(!m, `в ${path.relative(root, f)} чужой тег движка: ${m && m[0]}`);
  }
});

it('проба пишет факты: изоляция есть, продолжение — не доказано, наблюдения связаны со свидетелем', () => {
  const cap = probe();
  const witnessPath = path.join(root, '.minimax', '.state', 'observed-runtime.json');
  const witness = fs.existsSync(witnessPath) ? JSON.parse(fs.readFileSync(witnessPath, 'utf8')) : null;
  const obs = witness && witness.observations ? witness.observations : {};

  assert.equal(cap.engine, 'minimax');
  assert.equal(cap.isolation.available, true, 'изоляция в этом рантайме есть');
  assert.ok(cap.isolation.verifiedBy, 'у изоляции названо доказательство');
  assert.ok(cap.isolation.projectRolesMechanism, 'у регистрации назван механизм — плагин движка');
  assert.ok(cap.isolation.projectRolesReason, 'у этого пробела назван');

  // Регистрация ролей и доставка — наблюдения сессии: либо true со свидетелем, либо null с причиной.
  if (obs.agentRegistry) {
    assert.equal(cap.isolation.projectRolesRegistered, true, 'наблюдение есть — регистрация заявлена');
    assert.ok(cap.isolation.projectRolesReason.includes('observed-runtime.json'), 'названо свидетельство');
  } else {
    assert.equal(cap.isolation.projectRolesRegistered, null, 'без наблюдения — честное «не доказано»');
  }
  if (obs.roleDelivery) {
    assert.equal(cap.roleDelivery.available, true, 'доставка наблюдена — заявлена');
    assert.ok(cap.roleDelivery.verifiedBy && cap.roleDelivery.verifiedBy.includes('observed-runtime.json'), 'названо свидетельство');
    assert.ok(cap.roleDelivery.sessionId, 'у наблюдения назван идентификатор сессии');
  } else {
    assert.equal(cap.roleDelivery.available, null, 'без наблюдения — честное «не доказано»');
    assert.ok(cap.roleDelivery.reason, 'у остатка дисциплины названа причина');
  }

  // Продолжение вызова: либо доказано наблюдением (тогда названо свидетельство), либо честное
  // «не доказано». Проба никогда не ставит true по умолчанию.
  if (obs.continuation) {
    assert.equal(cap.continuation.available, true, 'продолжение наблюдено — заявлено');
    assert.ok(cap.continuation.verifiedBy && cap.continuation.verifiedBy.includes('observed-runtime.json'), 'названо свидетельство');
    assert.ok(cap.continuation.what && cap.continuation.how, 'названо, что и как наблюдалось');
    assert.ok(cap.continuation.childSessionId, 'у наблюдения назван идентификатор дочерней сессии');
  } else {
    assert.equal(cap.continuation.available, null, 'без наблюдения — честное «не доказано», не «true»');
    assert.ok(cap.continuation.reason, 'у недоказанного названа причина');
  }
  assert.equal(cap.usage.available, fs.existsSync(path.join(root, '.minimax', '.ledger', 'calls.jsonl')), 'расход доступен ровно тогда, когда есть журнал');
  assert.ok(cap.hooks.available === false || cap.hooks.package, 'хуки: либо названо место пакета, либо сказано, что пакета нет');
  if (cap.hooks.available) {
    assert.ok(cap.hooks.verifiedBy, 'у хуков названо доказательство');
    if (obs.hooks) {
      assert.equal(cap.hooks.deliveredInSession, true, 'хуки сработали в живой сессии');
      assert.ok(cap.hooks.observedLive.length, 'названо, какие события наблюдались вживую');
      assert.ok(cap.hooks.observedOnlyInSimulation.length, 'названо, что осталось только в симуляции');
    } else {
      assert.equal(cap.hooks.deliveredInSession, null, 'без наблюдения — честное «не доказано»');
    }
  }
});

it('живая запись в журнале принадлежит платформенным вызовам узлов движка', () => {
  const ledger = path.join(root, '.minimax', '.ledger', 'calls.jsonl');
  if (!fs.existsSync(ledger)) return; // журнала ещё нет — проверять нечего
  const recs = fs.readFileSync(ledger, 'utf8').split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
  for (const rec of recs) {
    assert.ok(rec.conversationId, 'у записи нет идентификатора вызова');
    assert.ok(rec.node, 'у записи не назван узел');
    // Число расхода — настоящее или неизвестное (null). Нулём неизвестное не подменяется (§3).
    assert.ok(
      rec.input_tokens === null || (typeof rec.input_tokens === 'number' && rec.input_tokens > 0),
      'число расхода — настоящее или null, но не ноль вместо неизвестного'
    );
    const line = deriveSpendLineForCall(rec, rec.node, 'test');
    assert.ok(
      /unknown tokens/.test(line) || /\d[\d\s ]* tokens/.test(line),
      'строка расхода говорит либо настоящее число, либо unknown'
    );
    assert.ok(line.includes('`' + rec.conversationId + '`'), 'идентификатор вызова должен попасть в строку расхода');
  }
});

it('проба не ставит true там, где нет доказательства', () => {
  const cap = probe();
  for (const [name, field] of Object.entries(cap)) {
    if (!field || typeof field !== 'object' || !('available' in field)) continue;
    if (field.available === true) {
      assert.ok(field.verifiedBy || field.mechanism || field.package, `${name}: available=true без доказательства`);
    }
    if (field.available === false || field.available === null) {
      assert.ok(field.reason, `${name}: недоступное поле без причины`);
    }
  }
});

it('файл возможностей на диске совпадает с пробой', () => {
  const p = path.join(root, '.minimax', '.state', 'capabilities.json');
  assert.ok(fs.existsSync(p), 'файл возможностей отсутствует — запустите node .minimax/scripts/capabilities.cjs');
  const onDisk = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal(onDisk.engine, 'minimax');
  assert.equal(typeof onDisk.isolation.available, 'boolean');
});

// 6. Чистота зоны (запрет 16)
it('в зоне нет следов проекта (запрет 16)', () => {
  // Правило — ядровое (`scanCleanFile`): одна правда для всех зон. Своей проверки тут нет.
  const { scanCleanFile } = require('../../.claude/scripts/checks/support/clean-zone.cjs');
  // Машинное состояние движка (`.state/`, `.ledger/`) не поставляется: там время пробы и пути
  // машины — как в журнале инструментов ядра. Проверяется содержимое зоны.
  const MACHINE_STATE = new Set(['.state', '.ledger']);
  const walk = (dir) => {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!MACHINE_STATE.has(e.name)) out.push(...walk(p));
      } else out.push(p);
    }
    return out;
  };
  const problems = [];
  for (const f of walk(path.join(root, '.minimax'))) {
    const rel = path.relative(root, f).split(path.sep).join('/');
    if (!/\.(md|cjs|js|mjs|html)$/.test(rel)) continue;
    problems.push(...scanCleanFile(rel, fs.readFileSync(f, 'utf8')));
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

// 7. Пакет плагина движка
const PKG = path.join(root, 'miniapps', 'minimax-engine');
const PKG_MANIFEST = path.join(PKG, '.minimax-plugin', 'plugin.json');
const PKG_HOOKS = path.join(PKG, 'hooks', 'hooks.json');
const PKG_HOOK_SCRIPT = path.join(PKG, 'scripts', 'hook.mjs');

it('пакет плагина собран по контракту V1: манифест, иконки, агенты, пути', () => {
  const m = JSON.parse(fs.readFileSync(PKG_MANIFEST, 'utf8'));
  assert.equal(m.schemaVersion, 1);
  assert.match(m.name, /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/, 'имя плагина должно быть kebab-case');
  assert.match(m.version, /^\d+\.\d+\.\d+$/, 'версия должна быть SemVer');
  assert.ok(m.description && m.description.length > 10, 'у плагина должно быть описание');
  assert.ok(m.author, 'у плагина должен быть автор');
  assert.ok(m.category, 'у плагина должна быть категория');
  assert.ok(
    Array.isArray(m.exampleQueries) && m.exampleQueries.length && m.exampleQueries.every((q) => String(q).trim()),
    'нужен хотя бы один непустой пример запроса'
  );
  assert.deepEqual(m.apps, [], 'локальные приложения не поддерживаются — apps должен быть пустым');
  assert.ok(m.agents.length, 'у пакета должны быть субагенты');
  for (const rel of [...m.agents, ...m.hooks, ...m.mcpServers, ...m.skills]) {
    assert.ok(!path.isAbsolute(rel) && !rel.includes('\\') && !rel.includes('..'), `путь не переносимый: ${rel}`);
    assert.ok(fs.existsSync(path.join(PKG, ...rel.split('/'))), `файл не найден: ${rel}`);
  }
  assert.ok(fs.existsSync(path.join(PKG, m.icon)), 'иконка по умолчанию отсутствует');
  if (m.darkIcon) assert.ok(fs.existsSync(path.join(PKG, m.darkIcon)), 'тёмная иконка отсутствует');
});

it('субагенты пакета: имя = имя файла, описание есть, `task` не указан', () => {
  const m = JSON.parse(fs.readFileSync(PKG_MANIFEST, 'utf8'));
  for (const rel of m.agents) {
    assert.match(rel, /^agents\/[a-z][a-z0-9_-]*\.md$/, `путь субагента не по контракту: ${rel}`);
    const txt = fs.readFileSync(path.join(PKG, ...rel.split('/')), 'utf8');
    const fm = txt.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    assert.ok(fm, `у ${rel} нет фронтматтера`);
    const name = (fm[1].match(/^name:\s*(.*)$/m) || [])[1];
    const desc = (fm[1].match(/^description:\s*(.*)$/m) || [])[1];
    const tools = (fm[1].match(/^tools:\s*\[(.*)\]$/m) || [])[1];
    assert.equal(name && name.trim(), path.basename(rel, '.md'), `имя субагента не равно имени файла: ${rel}`);
    assert.ok(desc && desc.trim().length > 10, `у ${rel} пустое описание`);
    if (tools) {
      const names = tools.split(',').map((t) => t.trim()).filter(Boolean);
      assert.ok(!names.includes('task'), `у ${rel} указан task — субагент плагина не делегирует дальше`);
      for (const t of names) {
        assert.ok(!/^(Read|Write|Edit|Bash|Grep|Glob|Task|Agent|AskUserQuestion)$/.test(t), `у ${rel} псевдоним инструмента: ${t}`);
        assert.match(t, /^[a-z][a-z0-9_]*$/, `у ${rel} не нативное имя инструмента: ${t}`);
      }
    }
  }
});

it('хуки пакета: поддерживаемые события, синхронный обработчик, переносимая команда', () => {
  const h = JSON.parse(fs.readFileSync(PKG_HOOKS, 'utf8'));
  const SUPPORTED = new Set([
    'SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest',
    'PostToolUse', 'SubagentStart', 'SubagentStop', 'Stop', 'PreCompact', 'PostCompact',
  ]);
  let count = 0;
  for (const [event, groups] of Object.entries(h.hooks)) {
    assert.ok(SUPPORTED.has(event), `событие не поддерживается рантаймом: ${event}`);
    for (const group of groups) {
      if (group.matcher !== undefined) {
        assert.ok(group.matcher.length <= 256, `matcher длиннее 256 символов: ${event}`);
      }
      for (const handler of group.hooks) {
        count += 1;
        assert.equal(handler.type, 'command', 'обработчик должен быть синхронной командой');
        assert.ok(handler.command && handler.command.includes('${PLUGIN_ROOT}'), 'команда должна идти через ${PLUGIN_ROOT}');
        assert.ok(handler.timeout >= 1 && handler.timeout <= 10, 'таймаут вне диапазона 1–10 секунд');
      }
    }
  }
  assert.ok(count > 0, 'у пакета нет ни одного обработчика');
  assert.ok(count <= 64, 'обработчиков больше 64');
});

it('скрипт хука синтаксически валиден для node', () => {
  const r = spawnSync(process.execPath, ['--check', PKG_HOOK_SCRIPT], { encoding: 'utf8' });
  assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''));
});

it('субагенты пакета совпадают с ролями зоны — перегенерацией', () => {
  const r = spawnSync(process.execPath, [path.join(root, '.minimax', 'scripts', 'gen-plugin-agents.cjs'), '--check'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''));
});

it('установленная копия пакета в профиле совпадает с исходником', () => {
  const { diff, targetDir } = require('../scripts/install-plugin.cjs');
  const dst = targetDir();
  if (!fs.existsSync(dst)) {
    // Пакета в профиле нет — это состояние среды, а не дефект пакета; проба говорит об этом честно.
    assert.equal(probe().hooks.available, false, 'проба должна сказать, что пакета в профиле нет');
    console.log('  (пакет не установлен в профиль — паритет не проверялся)');
    return;
  }
  const d = diff(PKG, dst);
  assert.deepEqual(d.missing, [], 'в профиле нет файлов пакета');
  assert.deepEqual(d.changed, [], 'файлы пакета в профиле разошлись с исходником');
  assert.deepEqual(d.extra, [], 'в профиле есть лишние файлы пакета');
});

it('хук пакета работает: охрана, фраза-пароль, доставка роли, журнал вызовов', () => {
  const os = require('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-minimax-hook-'));
  try {
    // Фикстура — проект протокола во временной папке: хук пишет только туда.
    const proj = path.join(tmp, 'project');
    fs.mkdirSync(path.join(proj, '.minimax', 'agents'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'AGENTS.md'), '# law\n', 'utf8');
    fs.writeFileSync(path.join(proj, '.minimax', 'agents', 'intent.md'), '# intent\n', 'utf8');
    const env = {
      ...process.env,
      PLUGIN_ROOT: PKG,
      PLUGIN_DATA: path.join(tmp, 'plugin-data'),
      MINIMAX_PROJECT_DIR: proj,
    };
    const run = (payload) => {
      const r = spawnSync(process.execPath, [PKG_HOOK_SCRIPT], { env, input: JSON.stringify(payload), encoding: 'utf8' });
      return { status: r.status, out: (r.stdout || '').trim() };
    };

    const start = run({ hook_event_name: 'SessionStart', source: 'startup' });
    assert.equal(start.status, 0);
    const ctx = JSON.parse(start.out).hookSpecificOutput;
    assert.equal(ctx.hookEventName, 'SessionStart');
    assert.ok(ctx.additionalContext.includes('.minimax'), 'роль главной сессии не названа');

    const deny = run({ hook_event_name: 'PreToolUse', tool_name: 'bash', tool_input: { command: 'rm -- "AGENTS.md"' } });
    assert.equal(deny.status, 0);
    const d = JSON.parse(deny.out).hookSpecificOutput;
    assert.equal(d.permissionDecision, 'deny', 'удаление защищённого пути должно быть отклонено');
    assert.match(d.permissionDecisionReason, /Отключи сенсорику/, 'в отказе не названа фраза-пароль');

    const quiet = run({ hook_event_name: 'PreToolUse', tool_name: 'bash', tool_input: { command: 'rm -- "notes.txt"' } });
    assert.equal(quiet.status, 0);
    assert.equal(quiet.out, '', 'на чужой путь хук молчит');

    const phrase = run({ hook_event_name: 'UserPromptSubmit', prompt: 'Отключи сенсорику' });
    assert.equal(phrase.status, 0);
    assert.equal(phrase.out, '', 'фраза не блокирует промпт');
    const marker = path.join(proj, '.minimax', 'hooks', '.delete-unlock');
    assert.ok(fs.existsSync(marker), 'маркер не создан');
    const allowed = run({ hook_event_name: 'PreToolUse', tool_name: 'bash', tool_input: { command: 'rm -- "AGENTS.md"' } });
    assert.equal(allowed.out, '', 'с маркером действие проходит');
    assert.ok(!fs.existsSync(marker), 'маркер одноразовый — он исчезает');
    const again = run({ hook_event_name: 'PreToolUse', tool_name: 'bash', tool_input: { command: 'rm -- "AGENTS.md"' } });
    assert.equal(JSON.parse(again.out).hookSpecificOutput.permissionDecision, 'deny', 'после маркера снова отказ');

    const id = 'call-sim-0001';
    run({ hook_event_name: 'SubagentStart', agent_id: id, agent_type: 'minimax-engine:spec' });
    const stop = run({ hook_event_name: 'SubagentStop', agent_id: id, agent_type: 'minimax-engine:spec' });
    assert.equal(stop.status, 0);
    const ledgerFile = path.join(proj, '.minimax', '.ledger', 'calls.jsonl');
    assert.ok(fs.existsSync(ledgerFile), 'журнал вызовов не создан');
    const rec = JSON.parse(fs.readFileSync(ledgerFile, 'utf8').trim().split('\n').pop());
    assert.equal(rec.conversationId, id, 'идентификатор вызова — платформенный');
    assert.equal(rec.node, 'Spec', 'узел назван по типу агента');
    assert.equal(rec.input_tokens, null, 'непрочитанное число — null, а не ноль');
    const line = deriveSpendLineForCall(rec, 'Spec', 'test: симуляция хука');
    assert.match(line, /unknown tokens/, 'строка расхода говорит unknown, а не ноль');
    assert.ok(line.includes('`' + id + '`'), 'идентификатор вызова должен попасть в строку расхода');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// 8. Расход: числа берутся из стенограммы платформы, а не выдумываются
it('ридер стенограмм находит сессию по идентификатору и достаёт числа', () => {
  const reader = require(path.join(root, 'miniapps', 'minimax-engine', 'scripts', 'transcripts.cjs'));
  assert.ok(reader.sessionsRoot(process.env), 'хранилище сессий рантайма должно находиться');
  const ledgerFile = path.join(root, '.minimax', '.ledger', 'calls.jsonl');
  if (!fs.existsSync(ledgerFile)) return;
  const recs = fs.readFileSync(ledgerFile, 'utf8').split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
  const numbered = recs.filter((r) => typeof r.input_tokens === 'number');
  if (!numbered.length) return; // платформенных записей с числами ещё нет
  for (const rec of numbered) {
    assert.ok(rec.model, 'у записи с числами должна быть названа модель');
    assert.ok(rec.input_tokens > 0, 'число токенов ввода должно быть настоящим');
    const u = reader.readUsage(rec.conversationId);
    assert.ok(u, 'стенограмма по этому идентификатору обязана находиться');
    // Запись журнала — снимок на момент `SubagentStop`: стенограмма вызова дописывается после
    // остановки, поэтому её полные итоги могут быть больше снимка. Свойство записи: её числа
    // совпадают с накопленными по первым K шагам стенограммы. Это «снимок против полного»,
    // а не расхождение; старые строки журнала и карточек не переписываются (запрет 5).
    const steps = reader.readSteps(rec.conversationId);
    let ci = 0;
    let co = 0;
    let cc = 0;
    let cw = 0;
    let snapshot = false;
    for (const s of steps) {
      ci += s.input || 0;
      co += s.output || 0;
      cc += s.cacheRead || 0;
      cw += s.cacheWrite || 0;
      const sameIn = ci === rec.input_tokens;
      const sameOut = co === rec.output_tokens;
      const sameCache = cc === rec.cache_read_tokens;
      const sameWrite = rec.cache_write_tokens === undefined || rec.cache_write_tokens === null || cw === rec.cache_write_tokens;
      if (sameIn && sameOut && sameCache && sameWrite) { snapshot = true; break; }
    }
    assert.ok(snapshot, 'числа записи журнала должны совпадать с накопленными по первым K шагам стенограммы (снимок на момент SubagentStop)');
    assert.ok(u.input >= rec.input_tokens, 'полная стенограмма не может быть меньше снимка');
  }
});

it('строка расхода берёт числа из полной стенограммы, а не из снимка журнала', () => {
  const ledgerFile = path.join(root, '.minimax', '.ledger', 'calls.jsonl');
  if (!fs.existsSync(ledgerFile)) return;
  const reader = require(path.join(root, 'miniapps', 'minimax-engine', 'scripts', 'transcripts.cjs'));
  const { deriveSpendLineForCall } = require(path.join(root, '.minimax', 'scripts', 'sync-ledger.cjs'));
  const recs = fs.readFileSync(ledgerFile, 'utf8').split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
  const rec = recs.find((r) => typeof r.input_tokens === 'number' && r.conversationId);
  if (!rec) return; // платформенных записей с числами ещё нет
  const u = reader.readUsage(rec.conversationId);
  if (!u) return; // стенограммы по этому вызову нет — сверять нечего
  const g = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const N = u.input + u.output + u.cache_read + u.cache_write;
  const line = deriveSpendLineForCall(rec, rec.node || 'Run', 'test: числа из полной стенограммы');
  assert.ok(line.includes(g(N) + ' tokens'), 'строка расхода должна нести полный расход вызова из стенограммы');
  assert.ok(line.includes(g(u.cache_read) + ' cache-read'), 'кэш-чтение в строке — из полной стенограммы');
  assert.ok(line.includes(', ' + g(u.output) + ' out'), 'выходные токены в строке — из полной стенограммы');
});

it('хук пишет в журнал настоящие числа и нормированную стенограмму', () => {
  const ledgerFile = path.join(root, '.minimax', '.ledger', 'calls.jsonl');
  if (!fs.existsSync(ledgerFile)) return;
  const rec = fs.readFileSync(ledgerFile, 'utf8').split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l))
    .find((r) => typeof r.input_tokens === 'number');
  if (!rec) return; // платформенной записи с числами ещё нет

  const os = require('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-minimax-spend-'));
  try {
    const proj = path.join(tmp, 'project');
    fs.mkdirSync(path.join(proj, '.minimax', 'agents'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'AGENTS.md'), '# law\n', 'utf8');
    fs.writeFileSync(path.join(proj, '.minimax', 'agents', 'intent.md'), '# intent\n', 'utf8');
    const env = {
      ...process.env,
      PLUGIN_ROOT: PKG,
      PLUGIN_DATA: path.join(os.homedir(), '.minimax', 'v2', 'plugin-data', 'hooks', 'minimax-engine'),
      MINIMAX_PROJECT_DIR: proj,
    };
    const r = spawnSync(process.execPath, [PKG_HOOK_SCRIPT], {
      env,
      input: JSON.stringify({
        hook_event_name: 'SubagentStop',
        agent_id: rec.conversationId,
        agent_type: 'minimax-engine:spec',
      }),
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''));
    const fixtureLedger = path.join(proj, '.minimax', '.ledger', 'calls.jsonl');
    assert.ok(fs.existsSync(fixtureLedger), 'журнал вызовов не создан');
    const written = JSON.parse(fs.readFileSync(fixtureLedger, 'utf8').trim().split('\n').pop());
    assert.equal(typeof written.input_tokens, 'number', 'число токенов должно быть настоящим, а не null');
    assert.ok(written.input_tokens > 0, 'число токенов должно быть больше нуля');
    assert.equal(written.agent_type, 'minimax-engine:spec', 'платформенное имя агента должно попасть в запись');
    assert.ok(written.model, 'модель должна быть названа');
    // Нормированная стенограмма — то, что читает дашборд.
    const trDir = path.join(proj, '.minimax', '.transcripts');
    assert.ok(fs.existsSync(trDir), 'нормированная стенограмма не записана');
    const files = fs.readdirSync(trDir).filter((f) => f.endsWith('.jsonl'));
    assert.ok(files.length, 'в каталоге стенограмм пусто');
    const first = JSON.parse(fs.readFileSync(path.join(trDir, files[0]), 'utf8').split('\n')[0]);
    assert.ok(first.message.usage, 'у нормированной записи нет расхода');
    assert.equal(typeof first.message.usage.cache_read_input_tokens, 'number', 'ядро ждёт это поле');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

it('строка расхода считает N по канону: полный вызов, кэш внутри, работа = N − R', () => {
  const ledger = path.join(root, '.minimax', '.ledger', 'calls.jsonl');
  if (!fs.existsSync(ledger)) return;
  const { fullUsage } = require(path.join(root, '.minimax', 'scripts', 'sync-ledger.cjs'));
  const recs = fs.readFileSync(ledger, 'utf8').split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
  const g = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  let checked = 0;
  for (const rec of recs) {
    if (rec.input_tokens == null || rec.output_tokens == null) continue;
    // Строка расхода берёт числа из ПОЛНОЙ стенограммы вызова; запись журнала — снимок на момент
    // `SubagentStop`, и он может быть меньше. Проверяем канон на тех числах, что несёт строка.
    const src = fullUsage(rec) || rec;
    const R = src.cache_read_tokens || 0;
    const W = src.cache_write_tokens || 0;
    const N = src.input_tokens + src.output_tokens + R + W;
    const line = deriveSpendLineForCall(rec, rec.node, 'test');
    assert.ok(line.includes(g(N) + ' tokens'), `N должен быть полным расходом вызова: ${line}`);
    assert.ok(line.includes('(' + g(R) + ' cache-read)'), `R должен быть кэш-чтением: ${line}`);
    assert.ok(line.includes(', ' + g(src.output_tokens) + ' out'), `выход должен быть в строке: ${line}`);
    assert.ok(N >= R, 'N не может быть меньше R — иначе ядро пересчитает итог');
    checked += 1;
  }
  assert.ok(checked > 0, 'нечего было проверять: в журнале нет записей с числами');
});

console.log(`\n${passed} проверок пройдено`);
