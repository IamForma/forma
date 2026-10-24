'use strict';

/**
 * Возможности движка MiniMax — факты, а не мнения (контракт 9).
 *
 * Файл `.minimax/.state/capabilities.json` пишет проба, а не узел. Ядро читает его
 * вместо самоотчёта: гейт изоляции в `.forma/board/new-card.cjs` смотрит на
 * `isolation.available` и не пускает производственный круг в деградированном режиме.
 *
 * Проба честна: что нельзя доказать из файловой системы — помечено `available: null` с причиной;
 * что доказанно отсутствует — `available: false` с причиной; `true` ставится только там, где
 * названо доказательство. Дисциплина, не подменённая конструкцией, объявляется дисциплиной.
 *
 * Запуск: node .minimax/scripts/capabilities.cjs
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const STATE = path.join(ROOT, '.minimax', '.state', 'capabilities.json');
const LEDGER = path.join(ROOT, '.minimax', '.ledger', 'calls.jsonl');
const PLUGIN_ID = 'minimax-engine';
/** Исходник пакета в проекте и установленная копия в профиле рантайма. */
const PLUGIN_SOURCE = path.join(ROOT, 'miniapps', PLUGIN_ID, '.minimax-plugin', 'plugin.json');
const PLUGIN_PROFILE = path.join(
  process.env.MINIMAX_DATA_DIR || path.join(os.homedir(), '.minimax'),
  'plugins', PLUGIN_ID, '.minimax-plugin', 'plugin.json'
);
/** События, которые несёт пакет движка. */
const PLUGIN_EVENTS = ['PreToolUse', 'UserPromptSubmit', 'SessionStart', 'SubagentStart', 'SubagentStop'];
/** Свидетель наблюдений сессии: доставка роли и регистрация ролей — из файлов не выводятся. */
const WITNESS = path.join(ROOT, '.minimax', '.state', 'observed-runtime.json');

function readWitness() {
  try {
    if (!fs.existsSync(WITNESS)) return null;
    const w = JSON.parse(fs.readFileSync(WITNESS, 'utf8'));
    return w && typeof w === 'object' ? w : null;
  } catch {
    return null;
  }
}

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/** Путь от корня проекта — в файле фактов не должно быть машинных путей (чистая зона). */
function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

function probe() {
  const now = new Date().toISOString();

  // Изоляция: дочерние сессии с отдельным контекстом даёт рантайм (task + продолжение вызова).
  // Доказательство — реестр агентов рантайма: без него изоляция не заявлена.
  const agentsRoot = path.join(os.homedir(), '.minimax', 'agents');
  const roster = fs.existsSync(agentsRoot)
    ? fs.readdirSync(path.join(agentsRoot, '.builtin'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : [];
  const pluginInstalled = exists(PLUGIN_PROFILE);
  const pluginRoles = 'minimax-engine:spec|minimax-engine:kit|minimax-engine:run|minimax-engine:core|minimax-engine:extractor|minimax-engine:plumb-haiku|minimax-engine:asset-describer-haiku';
  const witness = readWitness();
  const seenRegistry = witness && witness.observations && witness.observations.agentRegistry ? witness.observations.agentRegistry : null;
  const isolation = fs.existsSync(agentsRoot)
    ? {
        available: true,
        mechanism: 'task (дочерняя сессия с отдельным контекстом) + продолжение того же вызова по его task_id',
        verifiedBy: 'реестр агентов рантайма: ' + (roster.length ? roster.join(', ') : 'пуст') + ' (~/.minimax/agents/.builtin)',
        projectRolesRegistered: seenRegistry ? true : null,
        projectRolesMechanism:
          'плагин движка ' + PLUGIN_ID + ' регистрирует роли узлов как субагентов: ' + pluginRoles,
        projectRolesReason: seenRegistry
          ? 'делегация разрешилась и узлы отработали в отдельных дочерних сессиях: ' + seenRegistry.what +
            ' — доказательство: свидетель наблюдения .minimax/.state/observed-runtime.json и платформенные записи в журнале .minimax/.ledger/calls.jsonl'
          : pluginInstalled
            ? 'пакет установлен в профиле рантайма, но делегация пока не наблюдалась: ' +
              'реестр сессии собирается на её старте — нужна сессия, начатая после установки'
            : 'пакет плагина не установлен в профиле рантайма — роли узлов остаются файлами ролей, а не агентами рантайма',
      }
    : {
        available: false,
        reason: 'реестр агентов рантайма не найден — изоляция не заявлена',
        verifiedBy: 'проверка ~/.minimax/agents',
        projectRolesRegistered: false,
        projectRolesReason: 'реестра нет',
      };

  // Хуки: пакет движка стоит в профиле рантайма и несёт охрану удалений, доставку роли главной
  // сессии и журнал вызовов. Установлен — значит механизм есть; доставлен ли вывод в живую
  // сессию — отдельный вопрос, и он помечен честно.
  const pluginSourceExists = exists(PLUGIN_SOURCE);
  const seenHooks = witness && witness.observations && witness.observations.hooks ? witness.observations.hooks : null;
  const hooks = pluginInstalled
    ? {
        available: true,
        events: PLUGIN_EVENTS,
        package: PLUGIN_ID,
        source: pluginSourceExists ? rel(PLUGIN_SOURCE) : null,
        verifiedBy: 'пакет установлен в профиль рантайма; контракт манифеста и симуляция событий — в тесте зоны',
        observedLive: seenHooks ? seenHooks.observedLive : [],
        observedOnlyInSimulation: seenHooks ? seenHooks.observedOnlyInSimulation : PLUGIN_EVENTS,
        deliveredInSession: seenHooks ? true : null,
        deliveredReason: seenHooks
          ? null
          : 'ни одна сессия ещё не стартовала с установленным пакетом — вызов хука в живой сессии не наблюдался',
      }
    : {
        available: false,
        reason: 'пакет плагина движка не установлен в профиле рантайма — хуков охраны, доставки роли и журнала нет',
        source: pluginSourceExists ? rel(PLUGIN_SOURCE) : null,
      };

  // Продолжение того же вызова: механизм рантайма (task_append по task_id), из файловой системы
  // не выводится — доказательство живым вызовом, запись в свидетеле наблюдений сессии.
  // `null` — честное «не доказано пробой», а не `true` по умолчанию.
  const seenContinuation = witness && witness.observations && witness.observations.continuation ? witness.observations.continuation : null;
  const continuation = seenContinuation
    ? {
      available: true,
      reason: null,
      mechanism: 'task_append по идентификатору дочерней сессии',
      what: seenContinuation.what,
      how: seenContinuation.how,
      observedAt: seenContinuation.observedAt || witness.observedAt,
      sessionId: seenContinuation.sessionId || witness.sessionId,
      childSessionId: seenContinuation.childSessionId || null,
      verifiedBy: 'свидетель наблюдения сессии: .minimax/.state/observed-runtime.json (наблюдение продолжения)',
    }
    : {
      available: null,
      reason:
        'продолжение вызова — механизм рантайма (task_append по task_id); из файловой системы ' +
        'не доказуемо, поэтому проба не утверждает его наличие',
      mechanism: 'task_append по идентификатору дочерней сессии',
    };

  // Доставка роли главной сессии: хук SessionStart пакета отдаёт роль в документированной форме
  // (hookSpecificOutput.additionalContext). Форма проверена запуском хука, доставка — наблюдением
  // сессии; из файлов ни то, ни другое не выводится, поэтому доказательство — свидетель.
  const seenDelivery = witness && witness.observations && witness.observations.roleDelivery ? witness.observations.roleDelivery : null;
  const roleDelivery = seenDelivery
    ? {
        available: true,
        reason: null,
        method: 'Intent читает .minimax/agents/intent.md первым действием сессии',
        hook: 'SessionStart → hookSpecificOutput.additionalContext',
        what: seenDelivery.what,
        observedAt: witness.observedAt,
        sessionId: witness.sessionId,
        verifiedBy: 'свидетель наблюдения сессии: .minimax/.state/observed-runtime.json',
      }
    : {
        available: null,
        reason:
          'хук SessionStart пакета отдаёт роль главной сессии в документированной форме ' +
          '(hookSpecificOutput.additionalContext) — форма проверена симуляцией; доходит ли вывод до ' +
          'модели, не наблюдалось: свидетеля наблюдения нет',
        method: 'Intent читает .minimax/agents/intent.md первым действием сессии',
        hook: 'SessionStart → hookSpecificOutput.additionalContext',
      };

  // Расход: журнал вызовов — источник строк расхода. Его ведёт хук SubagentStop.
  const ledgerExists = exists(LEDGER);
  const ledgerRecords = ledgerExists
    ? fs.readFileSync(LEDGER, 'utf8').split(/\r?\n/).filter((l) => l.trim()).length
    : 0;

  return {
    engine: 'minimax',
    engineTag: 'minimax',
    probedAt: now,
    isolation,
    continuation,
    hooks,
    roleDelivery,
    usage: {
      source: 'ledger',
      available: ledgerExists,
      reason: ledgerExists
        ? null
        : 'журнала вызовов ещё нет: его ведёт хук SubagentStop, а вызовов субагентов движка ещё не было',
      ledger: rel(LEDGER),
      records: ledgerRecords,
      verifiedBy: ledgerExists
        ? 'журнал вызовов движка: ' + rel(LEDGER) + ' — записи платформенных вызовов, идентификаторы из payload хука'
        : null,
      writer:
        'хук SubagentStop пакета пишет идентификатор и длительность вызова; числа расхода ' +
        'берутся из стенограммы сессии рантайма (там платформа считает их пошагово); ' +
        'нет стенограммы — остаётся unknown, а не ноль',
    },
    note:
      'Проба пишет только то, что доказуемо из среды. Поле, которое нельзя доказать, ' +
      'помечено `available: null` с причиной; поле, доказанно отсутствующее, — `false`. ' +
      '`true` ставится только там, где доказательство названо.',
  };
}

function main() {
  const cap = probe();
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(cap, null, 2) + '\n', 'utf8');
  console.log('записано: ' + path.relative(ROOT, STATE).replace(/\\/g, '/'));
  console.log(JSON.stringify(cap, null, 2));
}

if (require.main === module) main();

module.exports = { probe, STATE };
