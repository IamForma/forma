#!/usr/bin/env node
'use strict';

/**
 * PreToolUse hook for Antigravity:
 * Intercepts invoke_subagent, verifies that the call is bound to a valid card (card-NNN)
 * per AGENTS.md §6 ("Any reach to a subagent is tied to a card — no exceptions"),
 * and validates that Run roles follow the catalog convention.
 * Outputs { decision: "deny" | "allow", reason?: string } on stdout.
 */

let inputData = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  let decision = { decision: 'allow' };

  try {
    if (inputData.trim()) {
      const payload = JSON.parse(inputData);
      const toolCall = payload.toolCall || {};
      const toolName = toolCall.name || '';
      const toolArgs = toolCall.args || {};

      if (toolName === 'invoke_subagent') {
        const prompt = String(toolArgs.Prompt || '');
        const role = String(toolArgs.Role || '');
        const typeName = String(toolArgs.TypeName || '');

        // 1. Проверка наличия номера карточки (card-NNN) в prompt или role
        const cardMatch = (prompt + ' ' + role).match(/\b(card-\d{1,4})\b/i);
        if (!cardMatch) {
          decision = {
            decision: 'deny',
            reason: 'Блокировка invoke_subagent (AGENTS.md §6): любой вызов субагента должен быть привязан к карточке. Укажите номер карточки (например: "Card: card-NNN" или "card-NNN") в параметре Prompt.',
          };
        }

        // 2. Проверка роли Run на соответствие каталогу (предупреждение в stderr)
        if (decision.decision === 'allow' && (typeName.toLowerCase() === 'run' || role.toLowerCase().startsWith('run'))) {
          const knownRunRoles = [
            'run-site-build', 'run-site-php', 'run-image', 'run-image-series',
            'run-text', 'run-mechanical', 'run-script', 'run-python',
            'run-vector', 'run-visual-check', 'run-schema-markup'
          ];
          const isCatalog = knownRunRoles.some(r => role.toLowerCase().includes(r) || typeName.toLowerCase().includes(r));
          if (!isCatalog && !role.toLowerCase().startsWith('run-')) {
            process.stderr.write(`[guard-subagent-card warning] Роль "${role}" не соответствует каталогу .agents/plugins/forma/agents/run/ (рекомендуется: run-site-php, run-image и т.д.).\n`);
          }
        }
      }
    }
  } catch (err) {
    process.stderr.write(`[guard-subagent-card error] ${err.message}\n`);
  }

  process.stdout.write(JSON.stringify(decision) + '\n');
});
