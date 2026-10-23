#!/usr/bin/env node
'use strict';
// Plumb-драйвер внешнего исполнителя (plumb: jev, OpenRouter Decisions API, typesafe/jev-1.14).
// Очищенная карточка + каталог ролей -> мост (external-model-bridge.cjs, Decisions API) ->
// строгий JSON {choice, score, noul}. Сам не вызывает haiku (у скрипта нет инструмента Agent) —
// при отсутствии ключа, ошибке моста или отказе очистки печатает {fallback:"haiku", reason:...}
// и завершается с кодом 0: вызывающий (главная сессия) тогда сам вызывает plumb-haiku.
//
// Использование:
//   node .claude/scripts/plumb-run.cjs <card.md> [--root DIR] [--site host[,host]] [--out FILE]
//
// Контракт вывода — такой же, как у plumb-haiku.md: {choice, score, noul}, плюс meta (не часть
// контракта, только для строки расхода): usage, cost_usd, duration_ms, id, model_served.

const fs = require('fs');
const path = require('path');
const { extractTask, loadSecrets, scrub, residue } = require('./plumb-scrub.cjs');
const { loadEnvKeyOptional, callDecisions, estimateCostUsd } = require('./external-model-bridge.cjs');

const MODEL = 'typesafe/jev-1.14';

function parseArgs(argv) {
  const a = { card: null, root: process.cwd(), site: [], out: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--root') a.root = path.resolve(argv[++i]);
    else if (v === '--site') a.site.push(...argv[++i].split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
    else if (v === '--out') a.out = argv[++i];
    else if (!a.card) a.card = v;
  }
  return a;
}

function buildCatalog(root) {
  const roleDir = path.join(root, '.claude', 'agents', 'run');
  const roles = [];
  for (const f of fs.readdirSync(roleDir).filter((n) => n.endsWith('.md')).sort()) {
    const md = fs.readFileSync(path.join(roleDir, f), 'utf8');
    const name = f.replace(/\.md$/, '');
    const desc = (/^description:\s*(.+)$/m.exec(md) || [])[1] || '';
    const take = (/## When to take\s+([\s\S]*?)\n## /.exec(md) || [])[1] || '';
    const tdn = (/## Takes \/ does not take\s+([\s\S]*?)\n## /.exec(md) || [])[1] || '';
    roles.push({ name, text: `${desc}\n${take.trim()}\n${tdn.trim()}`.trim() });
  }
  return roles;
}

function emit(obj, outFile) {
  const json = JSON.stringify(obj, null, 2);
  if (outFile) fs.writeFileSync(outFile, json);
  else console.log(json);
}

function fallback(reason, extra, outFile) {
  emit({ fallback: 'haiku', reason, ...(extra || {}) }, outFile);
  process.exit(0);
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.card) {
    console.error('usage: plumb-run.cjs <card.md> [--root DIR] [--site host] [--out FILE]');
    process.exit(1);
  }

  const apiKey = loadEnvKeyOptional('OPENROUTER_API_KEY', a.root);
  if (!apiKey) return fallback('no-key', null, a.out);

  let md;
  try {
    md = fs.readFileSync(a.card, 'utf8');
  } catch (e) {
    console.error(`cannot read card: ${e.message}`);
    process.exit(1);
  }
  const task = extractTask(md);
  if (!task) {
    console.error('card has no ## Task / ## Задача zone');
    process.exit(1);
  }

  const siteHosts = new Set(a.site);
  const secrets = loadSecrets(a.root, siteHosts);

  const { text: scrubbedTask, counts: taskCounts } = scrub(task, secrets, siteHosts);
  const taskResidue = residue(scrubbedTask, secrets);
  if (taskResidue.length) return fallback('scrub-refused', { report: { refused: taskResidue } }, a.out);

  const roles = buildCatalog(a.root);
  const catalogText = roles.map((r) => `### ${r.name}\n${r.text}`).join('\n\n');
  const { text: scrubbedCatalog, counts: catalogCounts } = scrub(catalogText, secrets, siteHosts);
  const catalogResidue = residue(scrubbedCatalog, secrets);
  if (catalogResidue.length) return fallback('scrub-refused', { report: { refused: catalogResidue } }, a.out);

  // Разбираем очищенный каталог обратно по ролям (порядок и границы те же, что при склейке) —
  // так noul-критерии каждой роли видят её же текст, уже очищенный, не исходный.
  const scrubbedSections = scrubbedCatalog.split(/\n(?=### )/);
  const byRole = {};
  for (const sec of scrubbedSections) {
    const m = /^### (\S+)\n([\s\S]*)$/.exec(sec);
    if (m) byRole[m[1]] = m[2].trim();
  }

  const roleCriteria = {};
  for (const r of roles) roleCriteria[r.name] = (byRole[r.name] || r.text).slice(0, 600);

  const questions = {
    role: {
      type: 'choice',
      instructions: 'Which catalog role fits this task best, judged only by its own criteria text?',
      criteria: roleCriteria,
    },
    clarity: {
      type: 'score',
      instructions: 'How clearly is the task stated — result, form and criterion unambiguous?',
      criteria: [
        'Cannot tell what is wanted',
        'Vague: goal guessable, form or criterion missing',
        'Goal clear, form or criterion still ambiguous',
        'Goal and form clear, criterion has one small gap',
        'Result, form and criterion unambiguous',
      ],
    },
  };
  for (const r of roles) {
    questions[`fit_${r.name}`] = {
      type: 'noul',
      instructions: `Does the role "${r.name}" (its criteria are in state.catalog) take this task as written?`,
      criteria: {
        true: 'The task matches this role\'s "takes" examples and stays inside its boundary.',
        false: 'The task matches this role\'s "does not take" examples or falls outside its boundary.',
      },
    };
  }

  const state = { task: scrubbedTask, catalog: scrubbedCatalog };

  const t0 = Date.now();
  let res;
  try {
    res = await callDecisions({ apiKey, model: MODEL, questions, state });
  } catch (e) {
    return fallback('bridge-error', { report: { message: e.message } }, a.out);
  }
  const durationMs = Date.now() - t0;

  const answers = res.answers || {};
  if (!answers.role || typeof answers.role.choice !== 'string' || !answers.clarity) {
    return fallback('bad-response', { report: { message: 'missing role/clarity in answers' } }, a.out);
  }

  const choice = {
    role: answers.role.choice,
    probabilities: Object.fromEntries(
      Object.entries(answers.role.probabilities || {}).map(([k, v]) => [k, Math.round(v * 100)])
    ),
    confidence: Math.round((answers.role.confidence || 0) * 100),
  };
  const score = {
    clarity: Math.max(0, Math.min(4, Math.round(answers.clarity.score ?? 0))),
    confidence: Math.round((answers.clarity.confidence || 0) * 100),
  };
  const topTwo = Object.entries(choice.probabilities)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 2)
    .map(([k]) => k);
  const noul = {};
  for (const name of topTwo) {
    const ans = answers[`fit_${name}`];
    if (ans && typeof ans.noul === 'number') noul[name] = ans.noul;
  }

  const usage = res.usage || {};
  const costUsd =
    typeof usage.cost === 'number'
      ? usage.cost
      : estimateCostUsd('openrouter', MODEL, { prompt_tokens: usage.input_tokens, completion_tokens: usage.output_tokens });

  emit(
    {
      choice,
      score,
      noul,
      meta: {
        executor: 'jev',
        model_requested: MODEL,
        model_served: res.model || null,
        id: res.id || null,
        usage: { prompt_tokens: usage.input_tokens ?? null, completion_tokens: usage.output_tokens ?? null },
        cost_usd: costUsd === null ? null : Number(costUsd.toFixed(6)),
        duration_ms: durationMs,
        scrub_report: { task: taskCounts, catalog: catalogCounts },
      },
    },
    a.out
  );
}

main().catch((e) => {
  console.error('plumb-run error:', e.message);
  fallback('error', { report: { message: e.message } });
});
