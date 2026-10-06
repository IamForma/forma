'use strict';
// Роль, которая в тексте велит запускать скрипт доски, должна иметь его в списке `tools:`: иначе в живом вызове
// подагента команда отклоняется, а роль молча откатывается на ручную правку карточки. Замер в основной сессии
// (где разрешено всё) такую дыру не видит — её ловит только сверка текста роли со списком.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const AGENTS = path.join(__dirname, '..', 'skills', 'forma', 'adapters');
const SCRIPTS = ['card-move', 'new-card', 'check-board', 'run-in-card'];
const ENGINES = ['claude', 'gemini'];

function role(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!m) return null;
  const tools = (m[1].match(/^tools:\s*(.*)$/m) || [])[1];
  return { tools: tools == null ? null : tools, body: m[2] };
}

const allows = (tools, script) => tools.includes(`Bash(node .forma/board/${script}.cjs *)`) || tools.includes('Bash(node .forma/board/*)');

for (const engine of ENGINES) {
  const dir = path.join(AGENTS, engine, 'agents');
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.md'))) {
    test(`${engine}/${name}: скрипты доски из текста роли разрешены в tools`, () => {
      const r = role(path.join(dir, name));
      if (!r || r.tools == null || !/\bBash\b/.test(r.tools)) return; // роль без списка или без Bash — не наш случай: Bash ей не даётся совсем
      const used = SCRIPTS.filter((s) => new RegExp(`node \\.forma/board/${s}\\.cjs\\b`).test(r.body));
      const missing = used.filter((s) => !allows(r.tools, s));
      assert.deepEqual(missing, [], `${engine}/${name}: в тексте есть вызов, которого нет в tools: ${missing.join(', ')}`);
    });
  }
}

test('Spec создаёт карточки скриптом, Run и Core передают их card-move (а не правят файл)', () => {
  for (const engine of ENGINES) {
    const g = (n) => role(path.join(AGENTS, engine, 'agents', n + '.md'));
    assert.ok(allows(g('spec').tools, 'new-card'), engine + '/spec: нет new-card');
    assert.ok(allows(g('run').tools, 'card-move'), engine + '/run: нет card-move');
    assert.ok(allows(g('core').tools, 'card-move'), engine + '/core: нет card-move');
  }
});
