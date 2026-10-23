'use strict';

// Self-check of the role parity rules on a temporary pair of roles (never the real tree):
// tool equivalence is data, a changed phrase stays a drift, an own role is declared in the engine's rules file.
//   node --test .claude/scripts/checks/support/test-role-parity.cjs

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const parity = require('./role-parity.cjs');

function fixture(baseText, peerText) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'role-parity-'));
  fs.mkdirSync(path.join(root, 'a'), { recursive: true });
  fs.mkdirSync(path.join(root, 'b'), { recursive: true });
  fs.writeFileSync(path.join(root, 'a/r.md'), baseText);
  fs.writeFileSync(path.join(root, 'b/r.md'), peerText);
  return { root, pair: { name: 'Agent: R', base: 'a/r.md', peer: 'b/r.md', type: 'agent', from: 'a', to: 'b' } };
}
const cmp = (b, p, own) => { const f = fixture(b, p); try { return parity.comparePair(f.root, f.pair, [], own); } finally { fs.rmSync(f.root, { recursive: true, force: true }); } };

test('swapping a tool for its equivalent is not a drift', () => {
  assert.equal(cmp('Send it via `SendMessage` to the id.', 'Send it via `task_append` to the id.').status, 'synced');
});

test('a changed phrase next to the tool is a drift', () => {
  const res = cmp('Send it via `SendMessage` to the id.', 'Send it via `task_append` to the live id.');
  assert.equal(res.status, 'drift');
});

test('a tool name outside the equivalence table is a drift', () => {
  assert.equal(cmp('Send it via `SendMessage`.', 'Send it via `other_tool`.').status, 'drift');
});

test('a role not declared own, with other text, is a drift', () => {
  assert.equal(cmp('one text', 'another text', new Set()).status, 'drift');
});

test('a role declared own gets the own status, and the table prints it apart from parity and drift', () => {
  const res = cmp('one text', 'another text', new Set(['b/r.md']));
  assert.equal(res.status, 'own');
  const line = parity.parityTable([{ pair: { name: 'x', base: 'a', peer: 'b' }, res }]).pop();
  assert.ok(line.includes('Своя роль') && !line.includes('Паритет') && !line.includes('Дрейф'));
});

test('ownRolesOf reads paths from the paragraph that says "written by this zone"', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'role-parity-'));
  try {
    fs.mkdirSync(path.join(root, 'b'), { recursive: true });
    fs.writeFileSync(path.join(root, 'b/rules.md'), 'Intro `b/agents/mirror.md` is a mirror.\n\nThe role `b/agents/mine.md` is\nwritten by this zone, not copied.\n');
    const peer = { adapter: { engineRulesFile: 'b/rules.md' }, src: { rolesDir: 'b/agents' } };
    assert.deepEqual([...parity.ownRolesOf(root, peer)], ['b/agents/mine.md']);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
