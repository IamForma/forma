'use strict';
// Demo cycle: the marker `project/config/DEMO` (none/declined/later:<n>/done) decides whether the start report says
// "demo never offered"; it is said only on a fresh project (gate closed, board empty); demo cards pass the board
// check under a closed gate and stay out of the statistics.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'forma.cjs');
const NOTE = /demo cycle was never offered/;

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-demo-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-h-'));
  const r = spawnSync(process.execPath, [BIN, 'init', '--yes', '--board', 'skip', '--no-dashboard', '--dir', dir],
    { encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return dir;
}
const node = (dir, ...args) => spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir, FORMA_LANG: 'en' } });
const cli = (dir, ...args) => node(dir, path.join(dir, '.forma', 'i18n', 'cli.cjs'), ...args);
const card = (dir, ...args) => node(dir, path.join(dir, '.forma', 'board', 'new-card.cjs'), ...args);
const ready = (dir) => cli(dir, 'ready').stdout;

test('fresh project: the demo is reported once, the marker reads none', () => {
  const dir = project();
  assert.equal(cli(dir, 'demo').stdout.trim(), 'none');
  assert.match(ready(dir), NOTE);
  const hook = spawnSync('sh', [path.join(dir, '.claude', 'hooks', 'check-ready.sh')], { encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir, FORMA_LANG: 'en' } });
  assert.match(hook.stdout, NOTE);
});

test('declined and done are final; later:<n> counts session starts down and comes back', () => {
  const dir = project();
  assert.equal(cli(dir, 'demo', 'declined').stdout.trim(), 'declined');
  assert.doesNotMatch(ready(dir), NOTE);
  cli(dir, 'demo-tick');
  assert.equal(cli(dir, 'demo').stdout.trim(), 'declined', 'a tick changes nothing but later:<n>');
  cli(dir, 'demo', 'done');
  assert.doesNotMatch(ready(dir), NOTE);

  cli(dir, 'demo', 'later:2');
  assert.doesNotMatch(ready(dir), NOTE);
  cli(dir, 'demo-tick');
  assert.equal(cli(dir, 'demo').stdout.trim(), 'later:1');
  cli(dir, 'demo-tick');
  assert.equal(cli(dir, 'demo').stdout.trim(), 'none');
  assert.match(ready(dir), NOTE);
  assert.equal(fs.readFileSync(path.join(dir, 'project', 'config', 'DEMO'), 'utf8'), 'none\n');
});

test('a value outside the closed list is refused', () => {
  const dir = project();
  const r = cli(dir, 'demo', 'maybe');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /none\|declined\|done\|later/);
  assert.equal(cli(dir, 'demo').stdout.trim(), 'none');
});

test('a real card on the board: no offer; a demo card does not count as one', () => {
  const dir = project();
  const demo = card(dir, '--kind', 'goal', '--demo', '--route', '7', '--why', 'human', '--title', 'Demo: one-page description');
  assert.equal(demo.status, 0, demo.stdout + demo.stderr);
  assert.match(fs.readFileSync(path.join(dir, '.devtool', 'features', fs.readdirSync(path.join(dir, '.devtool', 'features')).find((f) => /^card-/.test(f))), 'utf8'), /labels: \[[^\]]*"demo"/);
  assert.match(ready(dir), NOTE, 'only demo cards: the board is still empty');
  const check = node(dir, path.join(dir, '.forma', 'board', 'check-board.cjs'));
  assert.equal(check.status, 0, 'a demo card is allowed under a goal in draft: ' + check.stdout + check.stderr);

  const real = card(dir, '--kind', 'incoming', '--title', 'Real request');
  assert.equal(real.status, 0, real.stdout + real.stderr);
  assert.doesNotMatch(ready(dir), NOTE);
});

test('production card without the demo label under a goal in draft is still refused', () => {
  const dir = project();
  const r = card(dir, '--kind', 'goal', '--route', '7', '--why', 'human', '--title', 'Real production card');
  assert.notEqual(r.status, 0, 'the exception is only for the demo');
});

test('statistics: the directory walk skips demo cards, a card named explicitly is counted', () => {
  const dir = project();
  const board = path.join(dir, '.devtool', 'features');
  const spend = '- `Run`, 2020-01-01: attempt, 1200 tokens (800 cache-read), 40 s, `abc123` — eng-x: done.\n';
  const write = (name, labels) => fs.writeFileSync(path.join(board, name), `---\nid: "${name}"\nstatus: "done"\nlabels: [${labels}]\n---\n# ${name}\n\n## History\n${spend}\n`);
  write('card-901-real.md', '"goal-goal", "route-7"');
  write('card-902-demo.md', '"goal-goal", "route-7", "demo"');
  const { tally } = require(path.join(dir, '.forma', 'dashboard', 'tally.cjs'));
  const all = tally([board]);
  const one = tally([path.join(board, 'card-902-demo.md')]);
  const real = tally([path.join(board, 'card-901-real.md')]);
  const attempts = (t) => Object.values(t.byNode).reduce((s, v) => s + v.attempts, 0);
  assert.equal(attempts(all), attempts(real), 'the walk counts the real card only');
  assert.equal(attempts(one), attempts(real), 'a demo card named explicitly is counted');
  assert.equal(attempts(real), 1, 'the fixture line is a recognised attempt');
});
