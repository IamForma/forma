'use strict';

/**
 * guard-core-cycle.cjs — конструктивный гейт накопления цикла Core (AGENTS.md §7).
 * Проверяет, накоплен ли объем карточек в эпике (по умолчанию 25, задается k:volume в PROJECT.md),
 * прежде чем субагент Core будет вызван для вынесения вердикта и закрытия цикла.
 *
 * Блокирует вызов Core, если accepted < volume, за исключением случаев:
 *  - передан флаг --force;
 *  - установлена переменная окружения FORMA_CYCLE_FORCE=1;
 *  - в промпте/аргументах присутствует явный маркер досрочного закрытия.
 */

const fs = require('fs');
const path = require('path');

function checkCoreCycleGuard(opts = {}) {
  const {
    toolName,
    args = {},
    root = process.cwd(),
    force = false,
    epic = null,
  } = opts;

  // 1. Если проверяется конкретный инструмент платформы (Antigravity PreToolUse)
  if (toolName && toolName !== 'invoke_subagent') {
    return { decision: 'allow' };
  }

  if (toolName === 'invoke_subagent') {
    const typeName = (args.TypeName || args.role || args.name || '').toLowerCase();
    const role = (args.Role || '').toLowerCase();
    const isCore = typeName === 'core' || role.includes('core');
    if (!isCore) {
      return { decision: 'allow' };
    }
  }

  // 2. Проверка флагов принудительного / досрочного запуска
  const prompt = String(args.Prompt || args.prompt || '');
  const isForce = Boolean(
    force ||
    (process.env.FORMA_CYCLE_FORCE && process.env.FORMA_CYCLE_FORCE !== '0') ||
    (Array.isArray(process.argv) && process.argv.includes('--force')) ||
    /--force\b|досрочн/i.test(prompt)
  );

  if (isForce) {
    return { decision: 'allow', reason: 'force override' };
  }

  // 3. Чтение объема цикла из PROJECT.md
  const pmPath = path.join(root, 'project', 'config', 'PROJECT.md');
  const oldPmPath = path.join(root, 'project', 'PROJECT.md');
  let pm = '';
  try {
    pm = fs.readFileSync(fs.existsSync(pmPath) ? pmPath : oldPmPath, 'utf8');
  } catch {}

  const vm = pm.match(/<!--\s*k:volume\s*-->\s*\|\s*(\d+)/i) ||
             pm.match(/^\|\s*(?:Объём\s*(?:круга|цикла)|Cycle volume)[^|]*\|\s*(\d+)/mi);
  const volume = vm ? +vm[1] : 25;

  // 4. Подсчет принятых карточек в done/ (status: "done" и assignee: "Core")
  const boardDir = path.join(root, '.devtool', 'features');
  const doneDir = path.join(boardDir, 'done');
  const perEpic = new Map();

  if (fs.existsSync(doneDir)) {
    for (const f of fs.readdirSync(doneDir)) {
      if (!f.endsWith('.md')) continue;
      try {
        const text = fs.readFileSync(path.join(doneDir, f), 'utf8');
        const cEpic = (text.match(/^epic:\s*"(.+?)"/m) || [])[1];
        const cAssignee = (text.match(/^assignee:\s*"?(.+?)"?\s*$/m) || [])[1];
        const cStatus = (text.match(/^status:\s*"(.+?)"/m) || [])[1];
        if (cEpic && cStatus === 'done' && cAssignee === 'Core') {
          perEpic.set(cEpic, (perEpic.get(cEpic) || 0) + 1);
        }
      } catch {}
    }
  }

  // 5. Определение проверяемого эпика и счетчика
  let targetEpic = epic;
  if (!targetEpic && prompt) {
    for (const ep of perEpic.keys()) {
      if (prompt.includes(ep)) {
        targetEpic = ep;
        break;
      }
    }
  }

  let accepted = 0;
  if (targetEpic && perEpic.has(targetEpic)) {
    accepted = perEpic.get(targetEpic);
  } else if (!targetEpic && perEpic.size > 0) {
    accepted = Math.max(...perEpic.values());
  }

  if (accepted < volume) {
    return {
      decision: 'deny',
      reason: `Отказ: В эпике накоплено ${accepted}/${volume} карточек. Вызов Core отложен до заполнения круга (или команды досрочного закрытия).`,
      accepted,
      volume,
      epic: targetEpic,
    };
  }

  return {
    decision: 'allow',
    accepted,
    volume,
    epic: targetEpic,
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const epicIdx = args.indexOf('--epic');
  const epic = epicIdx !== -1 ? args[epicIdx + 1] : null;
  const res = checkCoreCycleGuard({ force, epic });
  if (res.decision === 'deny') {
    console.error(res.reason);
    process.exit(1);
  } else {
    console.log(res.reason || `ok: накоплено ${res.accepted || 0}/${res.volume || 25} карточек`);
    process.exit(0);
  }
}

module.exports = { checkCoreCycleGuard };
