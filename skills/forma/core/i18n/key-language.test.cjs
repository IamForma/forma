// Code never parses a key by its Russian spelling: a Cyrillic word inside a regular expression or a comparison in the engine code is a violation,
// except the listed exceptions (a migration of old text, a legacy reader, free words of a human sentence). Russian spellings live in
// .forma/i18n/keys.json and in the locales only. node --test .forma/i18n/key-language.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const ROOTS = ['.claude/scripts', '.forma/board', '.forma/dashboard', '.forma/rules', '.forma/plumb', '.forma/i18n', '.claude/hooks'];
const SKIP = /(node_modules|[\\/]protocol[\\/]|[\\/]locales[\\/]|\.test\.cjs$|[\\/]messages[\\/]|[\\/]\.cache[\\/])/;
const CYR = /[А-Яа-яЁё]/;

// file (relative, with /) → why Russian words inside patterns are allowed there
const EXCEPTIONS = {
  '.forma/board/migrate-keys.cjs': 'the migration reads old Russian spellings from the dictionary and rewrites them',
  '.forma/dashboard/spend-line.cjs': 'toEnglish translates old Russian spend lines; the claim-line patterns name the legacy form',
  '.claude/scripts/card-session-spend.cjs': 'reader of spend lines written before the English window key',
  '.forma/dashboard/data/attempts.cjs': 'the spend line is parsed by its numbers; Cyrillic here is the unit word and a letter class',
  '.forma/dashboard/data/routes.cjs': 'headings of the routes manual are text, not keys',
  '.forma/dashboard/data/cards.cjs': 'spend lines of the cards tab, old unit words',
  // Free words of a human sentence, output of other tools, state values: not keys of a card or of PROJECT.md.
  '.claude/scripts/build-core-html-payload.cjs': 'a guard: any Cyrillic letter in the output',
  '.claude/scripts/build-kit-graphs.cjs': 'a state value of the resources registry, not a key',
  '.claude/scripts/checks/root-rules.cjs': 'text of a check message',
  '.claude/scripts/checks/support/clean-zone.cjs': 'patterns of the clean-zone check name Russian words of a project trace',
  '.claude/scripts/checks/support/test-law-pointers.cjs': 'a test of a Russian message',
  '.claude/scripts/checks/support/test-role-parity.cjs': 'a test of a Russian message',
  '.claude/scripts/dashboard-view.cjs': 'reads a terminal table of another tool',
  '.claude/scripts/engine-switch.cjs': 'reads the output of sync-engines',
  '.claude/scripts/plumb-scrub.cjs': 'scrub patterns: Russian words of a credential in free text',
  '.claude/scripts/resources.cjs': 'styles of an office document (Заголовок), not keys',
  '.claude/scripts/test-ledger-parity-reverse.cjs': 'a test of a Russian message',
  '.claude/scripts/translate-blocks-pipeline.cjs': 'a translation table of a project (column words are a project file format)',
  '.forma/dashboard/checks/locale-parity.cjs': 'the check looks for any Cyrillic letter',
  '.forma/dashboard/data/board.cjs': 'free words «карточка N» of a human sentence',
  '.forma/dashboard/serve.js': 'free word «позиция» of a node tag',
  '.forma/dashboard/subagents-log.cjs': 'a state phrase of the log',
  '.forma/dashboard/tally.cjs': 'a letter class of a service unit',
  '.forma/rules/guard-core-cycle.cjs': 'a free word of the human prompt',
  '.forma/i18n/project-checks.cjs': 'a value of the language field (documentation language), not a key',
  '.forma/dashboard/schema.cjs': 'free verbs of a role text (who calls whom), not keys',
  '.claude/hooks/unlock-delete.sh': 'the human code phrase is a password, literal',
};

const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : [p];
}) : []);

/** Lines whose code (not a comment, not a message template) tests a Cyrillic word in a pattern or a comparison. */
function offenders(file) {
  const out = [];
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((raw, i) => {
    const t = raw.trim();
    if (!CYR.test(t) || /^(\/\/|\*|\/\*)/.test(t)) return;
    const code = t.replace(/\s\/\/.*$/, '');
    if (!CYR.test(code)) return;
    if (/(console\.|\bdie\(|throw |problems\.push|\.push\(`)/.test(code)) return; // messages for the human
    const regexLiteral = /(^|[=(,:!&|?]\s*)\/(?![/*])(?:[^/\\\n]|\\.)*[А-Яа-яЁё](?:[^/\\\n]|\\.)*\/[gimsuy]*/.test(code);
    const regExpCtor = /new RegExp\(/.test(code);
    const comparison = /(===|!==|\.includes\(|\.startsWith\(|\.endsWith\(|\.indexOf\()\s*['"`][^'"`]*[А-Яа-яЁё]/.test(code);
    if (regexLiteral || regExpCtor || comparison) out.push(`${path.relative(ROOT, file).replace(/\\/g, '/')}:${i + 1}: ${t.slice(0, 140)}`);
  });
  return out;
}

test('no Russian key spelling in a pattern or a comparison of the engine code (outside the listed exceptions)', () => {
  const found = [];
  for (const r of ROOTS) {
    for (const f of walk(path.join(ROOT, r))) {
      if (SKIP.test(f) || !/\.(cjs|js|sh)$/.test(f)) continue;
      const rel = path.relative(ROOT, f).replace(/\\/g, '/');
      if (EXCEPTIONS[rel]) continue;
      found.push(...offenders(f));
    }
  }
  assert.deepEqual(found, [], 'move the Russian word into .forma/i18n/keys.json and read it by key:\n' + found.join('\n'));
});

test('every exception names a file that still exists', () => {
  for (const rel of Object.keys(EXCEPTIONS)) assert.ok(fs.existsSync(path.join(ROOT, rel)), rel);
});

test('keys.json: no Cyrillic in a key name, Russian only in labels and phrases', () => {
  const keys = require('./keys.json');
  for (const k of [...Object.keys(keys.labels), ...Object.keys(keys.phrases)]) assert.ok(!CYR.test(k), k);
});
