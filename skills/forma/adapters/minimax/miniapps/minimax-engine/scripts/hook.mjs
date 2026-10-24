#!/usr/bin/env node
'use strict';
/**
 * Обработчик хуков движка MiniMax Code (зона `.minimax/` протокола «Формы»).
 *
 * Пять обязанностей, по одной на событие:
 *   UserPromptSubmit — ловит кодовую фразу «Отключи сенсорику» и кладёт одноразовый
 *                      разрешающий маркер (фраза — пароль, а не описание; одно действие).
 *   PreToolUse       — охрана удалений: разрушающая команда по защищённому набору → deny.
 *   SessionStart     — доставка роли главной сессии (`Intent`) через additionalContext.
 *   SubagentStart    — запомнить, когда начался вызов узла.
 *   SubagentStop     — журнал вызовов: платформенный идентификатор вызова и его длительность.
 *
 * Формат входа читается терпимо (поле события ищется в нескольких именах): хук, который не
 * понял вход, молчит и ничего не ломает. Формат выхода — ровно один JSON-объект, когда хук
 * влияет на ход; иначе — пустой stdout и код 0.
 *
 * Хук работает только в проекте протокола: он узнаёт его по `AGENTS.md` и зоне `.minimax/`.
 * Установленный в профиле пакет обслуживает все проекты, и в чужом проекте охранять нечего —
 * там хук молчит.
 *
 * Числа расхода: payload хука не несёт токенов и кэш-чтения, поэтому в запись журнала они
 * попадают как null — и строка расхода остаётся «unknown», а не выдуманной (AGENTS.md §3).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const PROJECT = process.env.MINIMAX_PROJECT_DIR || process.cwd();
const ZONE = path.join(PROJECT, '.minimax');
const PLUGIN_ROOT = process.env.PLUGIN_ROOT || process.env.MINIMAX_PLUGIN_ROOT || path.join(PROJECT, 'miniapps', 'minimax-engine');
const DATA = process.env.PLUGIN_DATA || path.join(ZONE, '.plugin-data');
const LEDGER = path.join(ZONE, '.ledger', 'calls.jsonl');
const TRANSCRIPTS = path.join(ZONE, '.transcripts');
const UNLOCK = path.join(ZONE, 'hooks', '.delete-unlock');
const STARTED = path.join(DATA, 'started');

/**
 * Ридер стенограмм: настоящие числа расхода лежат там, а не в payload хука.
 * Модуль лежит рядом с хуком в пакете; если его нет — расход остаётся неизвестным, а не нулевым.
 */
let transcripts = null;
try {
  transcripts = require(path.join(PLUGIN_ROOT, 'scripts', 'transcripts.cjs'));
} catch {
  transcripts = null;
}

/** Кодовая фраза человека: пароль на одно действие, а не описание намерения. */
const PHRASE = 'Отключи сенсорику';

/** Разрушающие команды: их и только их охрана смотрит. */
const DESTRUCTIVE = [
  /\brm\b/i,
  /\brmdir\b/i,
  /\bdel\b/i,
  /\bRemove-Item\b/i,
  /\bMove-Item\b/i,
  /\bgit\s+clean\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\btruncate\b/i,
  /\bshred\b/i,
];

/** Защищённый набор: данные ядра, если они есть, иначе — набор пакета. */
const FALLBACK_PROTECTED = [
  '.claude', '.agents', '.codex', '.minimax', '.devtool',
  '.forma/manual', '.forma/living', 'miniapps',
  'AGENTS.md', 'PROJECT.md', 'GOAL.md', 'VARS',
];

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parseInput(text) {
  if (!text || !text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function eventName(payload) {
  if (!payload) return null;
  for (const k of ['hook_event_name', 'hookEventName', 'event_name', 'eventName', 'event']) {
    if (typeof payload[k] === 'string' && payload[k]) return payload[k];
  }
  return null;
}

/** Проект протокола «Формы»: закон на месте и зона движка на месте. */
function isFormaProject() {
  try {
    return fs.existsSync(path.join(PROJECT, 'AGENTS.md')) && fs.existsSync(path.join(ZONE, 'agents', 'intent.md'));
  } catch {
    return false;
  }
}

function protectedList() {
  const core = path.join(PROJECT, '.forma', 'rules', 'protected-paths.json');
  const own = path.join(PLUGIN_ROOT, 'scripts', 'protected-paths.json');
  for (const file of [core, own]) {
    try {
      if (!fs.existsSync(file)) continue;
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const list = Array.isArray(data) ? data : data.paths || data.protected || [];
      if (Array.isArray(list) && list.length) return list;
    } catch {
      /* битый список — берём запасной */
    }
  }
  return FALLBACK_PROTECTED;
}

/** Команда бьёт по защищённому набору? Ищем фрагмент как отдельный сегмент пути. */
function hitsProtected(command, fragments) {
  const cmd = String(command).replace(/\\/g, '/');
  return fragments.some((frag) => {
    const f = String(frag).replace(/\\/g, '/').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|[\\s"\'=(:;])' + f + '(/|\\b|$)').test(cmd);
  });
}

function isDestructive(command) {
  return DESTRUCTIVE.some((re) => re.test(command));
}

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* нет места — пишем в никуда, но не падаем */
  }
}

function nodeName(agentType) {
  const stem = String(agentType || '').split(':').pop() || 'unknown';
  const map = { spec: 'Spec', kit: 'Kit', run: 'Run', core: 'Core', extractor: 'Extractor', 'plumb-haiku': 'Plumb' };
  return map[stem] || stem;
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}

function handleUserPromptSubmit(payload) {
  const prompt = String((payload && payload.prompt) || '');
  if (!prompt.includes(PHRASE)) return;
  if (!isFormaProject()) return;
  ensureDir(path.dirname(UNLOCK));
  fs.writeFileSync(UNLOCK, new Date().toISOString(), 'utf8');
  // Событие-источник: фраза про разрешение — не блокировка промпта, а побочное действие.
  process.exit(0);
}

function handlePreToolUse(payload) {
  const tool = String((payload && payload.tool_name) || '');
  if (tool !== 'bash') return;
  const input = payload && payload.tool_input ? payload.tool_input : {};
  const command = String(input.command || '');
  if (!command) return;
  if (!isFormaProject()) return;
  if (!isDestructive(command)) return;
  if (!hitsProtected(command, protectedList())) return;

  // Фраза человека снимает запрет на одно действие: маркер одноразовый.
  if (fs.existsSync(UNLOCK)) {
    try { fs.unlinkSync(UNLOCK); } catch { /* маркер исчез — пусть и молча */ }
    process.exit(0);
  }
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        'Охрана протокола «Формы»: этот путь защищён (закон, роли, карточки, базы знаний). ' +
        'Фраза «' + PHRASE + '» снимает запрет на одно действие.',
    },
  });
}

function handleSessionStart() {
  if (!isFormaProject()) return;
  const intent = path.join(ZONE, 'agents', 'intent.md');
  const start = path.join(ZONE, 'agents', 'on-demand', 'intent-session-start.md');
  emit({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext:
        'Проект работает по протоколу «Форма». Главная сессия — узел `Intent`. ' +
        'Первым делом прочитай файл роли ' + intent +
        ' и файл начала сессии ' + start +
        ', затем говори с человеком как `Intent`. Правила закона — в AGENTS.md, §1–§7.',
    },
  });
}

function handleSubagentStart(payload) {
  const agentId = (payload && payload.agent_id) || '';
  if (!agentId) return;
  if (!isFormaProject()) return;
  ensureDir(STARTED);
  fs.writeFileSync(
    path.join(STARTED, agentId.replace(/[^\w.-]/g, '_') + '.json'),
    JSON.stringify({ startedAt: new Date().toISOString(), agentType: (payload && payload.agent_type) || '' }),
    'utf8'
  );
  process.exit(0);
}

function handleSubagentStop(payload) {
  const agentId = (payload && payload.agent_id) || '';
  if (!agentId) return;
  if (!isFormaProject()) return;
  const file = path.join(STARTED, agentId.replace(/[^\w.-]/g, '_') + '.json');
  let started = null;
  try {
    if (fs.existsSync(file)) {
      started = JSON.parse(fs.readFileSync(file, 'utf8'));
      fs.unlinkSync(file);
    }
  } catch {
    started = null;
  }
  const duration = started ? Math.max(0, Math.round((Date.now() - Date.parse(started.startedAt)) / 1000)) : null;
  ensureDir(path.dirname(LEDGER));
  const agentType = (started && started.agentType) || payload.agent_type || '';

  // Настоящие числа расхода берутся из стенограммы сессии — там рантайм пишет их пошагово.
  // Нет стенограммы — остаётся null, и строка расхода читается «unknown», а не ноль.
  let usage = null;
  let steps = [];
  if (transcripts) {
    try {
      usage = transcripts.readUsage(agentId);
      steps = transcripts.readSteps(agentId);
    } catch {
      usage = null;
    }
  }
  // Нормированная стенограмма — для дашборда: пол окна и разрезы по моделям.
  if (transcripts && steps.length) {
    try {
      const lines = transcripts.normalizedLines(steps);
      if (lines) {
        ensureDir(TRANSCRIPTS);
        const call = agentId.replace(/[^\w.-]/g, '_');
        fs.writeFileSync(path.join(TRANSCRIPTS, call + '.jsonl'), lines + '\n', 'utf8');
        // Раскладка, которую читает ядро (`card-move.cjs --agent-id`): <каталог>/<вызов>/subagents/agent-<вызов>.jsonl.
        // Ключ дедупликации `requestId` — на шаг: один шаг рантайма = один ответ API.
        const core = transcripts.coreLines ? transcripts.coreLines(steps) : lines;
        const nested = path.join(TRANSCRIPTS, call, 'subagents', `agent-${call}.jsonl`);
        ensureDir(path.dirname(nested));
        fs.writeFileSync(nested, core + '\n', 'utf8');
      }
    } catch {
      /* стенограмма не записалась — расход в журнале всё равно пишется */
    }
  }

  const record = {
    timestamp: new Date().toISOString(),
    conversationId: agentId,
    node: nodeName(agentType),
    agent_type: agentType,
    duration_s: duration,
    input_tokens: usage ? usage.input : null,
    output_tokens: usage ? usage.output : null,
    cache_read_tokens: usage ? usage.cache_read : null,
    cache_write_tokens: usage ? usage.cache_write : null,
    model: usage ? usage.model : null,
    note: usage
      ? 'числа — из стенограммы сессии рантайма'
      : 'payload хука не несёт расхода, стенограмма не найдена — числа остаются unknown (AGENTS.md §3)',
  };
  fs.appendFileSync(LEDGER, JSON.stringify(record) + '\n', 'utf8');
  process.exit(0);
}

const payload = parseInput(readStdin());
const event = eventName(payload);

switch (event) {
  case 'UserPromptSubmit':
    handleUserPromptSubmit(payload);
    break;
  case 'PreToolUse':
    handlePreToolUse(payload);
    break;
  case 'SessionStart':
    handleSessionStart();
    break;
  case 'SubagentStart':
    handleSubagentStart(payload);
    break;
  case 'SubagentStop':
    handleSubagentStop(payload);
    break;
  default:
    // Событие не понято или не наше — молча, код 0.
    process.exit(0);
}
