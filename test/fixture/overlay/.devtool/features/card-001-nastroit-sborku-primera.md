---
id: "card-001-nastroit-sborku-primera"
status: "review"
priority: "medium"
assignee: "Intent"
epic: "3. Form/Intent+Kit"
dueDate: null
created: "2031-01-01T10:00:00.000Z"
modified: "2031-01-02T10:00:00.000Z"
completedAt: null
labels: ["goal-forma", "route-4"]
order: "a0"
---
# card-001 · Настроить сборку примера

## Задача
001 · оснастка | сборка примера одной командой | команда сборки завершается без ошибок | 2 | человеку на приёмку

## Снаряжение
Роль: Kit · Навык: — · Инструмент: node · Доступ: — · Данные: — · Модель: text, sonnet, medium

## История
- `Intent`, 2031-01-01: route route-4 (why: tooling) — оснастка примера.
- `Intent`, 2031-01-01: stage approve — ждёт одобрения пяти полей.
- `Intent`, 2031-01-01: человек одобрил в сессии пять полей.
- `Kit`, 2031-01-01: stage exec — исполняет сам.
- `Kit`, 2031-01-02: attempt, 12000 tokens (3000 cache-read), 40 s, `a1b2c3d4e5f60718` — claude-code: собрал пример.
- `Intent`, 2031-01-02: stage check — проверка по критерию.

## Результат
Сборка примера проходит одной командой.
