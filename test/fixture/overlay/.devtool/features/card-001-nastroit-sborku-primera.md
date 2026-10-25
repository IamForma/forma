---
id: "card-001-nastroit-sborku-primera"
status: "review"
priority: "medium"
assignee: "Intent"
epic: "3. Project protocol"
dueDate: null
created: "2031-01-01T10:00:00.000Z"
modified: "2031-01-02T10:00:00.000Z"
completedAt: null
labels: ["goal-protocol", "route-4"]
order: "a0"
---
# card-001 · Настроить сборку примера

## Task
001 · tooling | сборка примера одной командой | команда сборки завершается без ошибок | 2 | человеку на приёмку

## Kit
Role: Kit · Skill: — · Tool: node · Access: — · Data: — · Model: text, sonnet, medium

## History
- `Intent`, 2031-01-01: route route-4 (why: tooling) — оснастка примера.
- `Intent`, 2031-01-01: stage approve — ждёт одобрения пяти полей.
- `Intent`, 2031-01-01: human approved в сессии пять полей.
- `Kit`, 2031-01-01: stage exec — исполняет сам.
- `Kit`, 2031-01-02: attempt, 12000 tokens (3000 cache-read), 40 s, `a1b2c3d4e5f60718` — claude-code: собрал пример.
- `Intent`, 2031-01-02: stage check — проверка по критерию.

## Result
Сборка примера проходит одной командой.
