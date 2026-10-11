'use strict';
// node .claude/scripts/plumb-scrub.test.cjs — fixtures are made up; no real secret is used.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, 'plumb-scrub.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'plumb-'));
const SECRET_ENV = 'zq9Xw3LpT7vRm2KdB8nYc5HfJ';
const SECRET_PASS = 'Hunter-Test-Pass-77';
const SITE = 'testsite.example';
const EMAIL = ['someone.fake', 'mailbox.example'].join('@');
const DATE = ['2026', '10', '11'].join('-');
const CARD = ['card', '102'].join('-');

fs.writeFileSync(path.join(root, '.env'), `API_TOKEN=${SECRET_ENV}\nSITE_URL=https://${SITE}/wp\nFLAG=true\n`);
fs.mkdirSync(path.join(root, 'VARS'));
fs.writeFileSync(path.join(root, 'VARS', 'credentials.md'), `# creds\n- test_password: ${SECRET_PASS}\n| name | value |\n|---|---|\n| test_login | fakelogin_42 |\n`);

const card = path.join(root, 'card.md');
const write = task => fs.writeFileSync(card, `# t\n\n## Задача\n${task}\n\n## История\n- secret history line ${SECRET_ENV}\n\n## Результат\n`);
const run = () => spawnSync('node', [script, card, '--root', root], { encoding: 'utf8' });

// 1. secrets, e-mail, domain, phone, ip, path are gone; history is not sent
write(`Войти как fakelogin_42 с паролем ${SECRET_PASS}, токен ${SECRET_ENV}, написать ${EMAIL}, ` +
  `сайт https://${SITE}/page и ${SITE}, тел +7 912 345-67-89, ip 10.0.0.12, файл C:\\Users\\Someone\\a.png, дата ${DATE}.`);
let r = run();
assert.strictEqual(r.status, 0, r.stdout + r.stderr);
for (const bad of [SECRET_ENV, SECRET_PASS, 'fakelogin_42', EMAIL, SITE, '912 345', '10.0.0.12', 'Someone', 'secret history line']) {
  assert.ok(!r.stdout.includes(bad), `leaked: ${bad}`);
}
const out = JSON.parse(r.stdout);
assert.ok(out.task.includes('[[credentials.test_password]]') && out.task.includes('[[API_TOKEN]]') && out.task.includes('[site]'));
assert.ok(out.task.includes(DATE), 'dates must survive');
assert.ok(!r.stdout.includes('history'), 'only the Task zone is sent');

// 2. residue refuses (secret-like string that nothing replaced)
write('Использовать ключ aB3dE5fG7hJ9kL2mN4pQ6rS8tU0 для вызова.');
r = run();
assert.strictEqual(r.status, 2, 'residue must refuse');
assert.strictEqual(JSON.parse(r.stdout).task, null);

// 3. card without a Task zone refuses
fs.writeFileSync(card, '# t\n\n## История\n- x\n');
assert.strictEqual(run().status, 2);

// 4. clean task passes untouched
write(`Перевести подпись на изображении v2/page-4 и записать результат в project/cards/${CARD}/out.`);
r = run();
assert.strictEqual(r.status, 0);
assert.ok(JSON.parse(r.stdout).task.includes(CARD));

fs.rmSync(root, { recursive: true, force: true });
console.log('plumb-scrub: all tests passed');
