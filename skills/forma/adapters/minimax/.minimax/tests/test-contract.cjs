'use strict';

// Контракт движка (ENGINE-CONTRACT.md) на реальном адаптере: все пункты `engines.cjs check`, собственные
// источники в своей папке, метка расхода, таблица узел-модель-усилие, ни одного пути из чужой папки.
//   node .minimax/tests/test-contract.cjs

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('../../.forma/dashboard/lib/engines.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = '.minimax';
const a = E.loadAdapters(ROOT).find((x) => x.dir === DIR);
assert.ok(a, 'адаптер ' + DIR + ' не найден ядром');

const bad = E.checkAdapter(a, ROOT).filter((r) => !r.ok);
assert.deepStrictEqual(bad, [], 'пункты контракта не пройдены: ' + JSON.stringify(bad));

const src = E.sourcesOf(a);
assert.ok(src.scriptsDir.startsWith(DIR + '/'), 'scriptsDir не в своей папке: ' + src.scriptsDir);
assert.ok(src.rolesDir.startsWith(DIR + '/'), 'rolesDir не в своей папке: ' + src.rolesDir);
assert.ok(src.packageManifest && fs.existsSync(path.join(ROOT, ...src.packageManifest.split('/'))), 'packageManifest не объявлен или файла нет');
assert.ok(a.spendTag && E.spendTags(ROOT).includes(a.spendTag), 'spendTag не виден ядру');
assert.strictEqual(E.engineTags(ROOT).find((t) => t.aliases.includes(a.spendTag)).tag, a.spendTag, 'основная метка расхода расходится со spendTag');
assert.strictEqual(E.modeOf(a), E.MODE_FULL);
console.log('ok  контракт движка ' + DIR + ': источники, метка расхода, таблица узел-модель-усилие');
