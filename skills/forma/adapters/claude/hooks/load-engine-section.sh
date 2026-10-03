#!/bin/sh
# SessionStart: подаёт в сессию §8 «Engine architecture in Claude Code»
# из .claude/rules/claude-8.md.
#
# Зачем хук. У Claude Code нет своего каталога always-on rules: файл под
# .claude/ сам по себе не подхватывается (в отличие от .agents/rules/ у
# Antigravity и .codex/ у Codex). §1–7 движок читает нативно из AGENTS.md,
# а §8 доставляется отсюда — печатью в stdout, которая попадает в контекст.
#
# Двойной подачи не бывает: пока в корне лежит CLAUDE.md, он несёт §8 сам,
# и хук молчит. Это же делает переход обратимым — вернули CLAUDE.md, и хук
# выключился, ничего не правя.
#
# Никогда не блокирует: выход всегда 0.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

RULES=".claude/rules/claude-8.md"

# Корневой CLAUDE.md на месте — §8 приходит через него, печатать нечего.
[ -f CLAUDE.md ] && exit 0

if [ ! -f "$RULES" ]; then
  echo "ВНИМАНИЕ: нет ни CLAUDE.md в корне, ни $RULES — узлы работают без §8 (архитектура движка). Проверьте .claude/hooks/load-engine-section.sh."
  exit 0
fi

# Закон §1–7 движок читает из AGENTS.md сам; если его нет — это уже не §8.
[ -f AGENTS.md ] || echo "ВНИМАНИЕ: в корне нет AGENTS.md — закон протокола §1–7 не загружен."

cat "$RULES"
exit 0
