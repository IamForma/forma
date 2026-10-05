'use strict';

/**
 * Командная строка: поиск флагов и разбор аргументов. Часть общей библиотеки ядра (`.forma/dashboard/lib/`).
 * Три способа читать одни и те же `argv` — по тому, что скрипту надо от значения; выбор — у вызывающего.
 */

/**
 * Поиск по `argv` (без `node` и пути скрипта или с ними — индексы не важны).
 *   flag('dry')      — флаг есть
 *   arg('kind', d)   — значение после `--kind`; следующего нет или оно само флаг — `d`
 *   value('n', d)    — сырое следующее слово после `--n` (флаг последний — `undefined`, не `d`); флага нет — `d`
 *   values('over')   — все значения повторяемого флага, сырые
 *   eq('only', d)    — значение в форме `--only=x`
 *   positional()     — слова, не начинающиеся с `--`
 *   die(prefix)      — печатает `<prefix>: <сообщение>` в stderr и завершает процесс кодом 2
 */
function makeCli(argv = process.argv.slice(2)) {
  const name = (n) => '--' + n;
  return {
    argv,
    flag: (n) => argv.includes(name(n)),
    arg(n, def) {
      const i = argv.indexOf(name(n));
      return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
    },
    value(n, def) {
      const i = argv.indexOf(name(n));
      return i > -1 ? argv[i + 1] : def;
    },
    values: (n) => argv.flatMap((a, i) => a === name(n) ? [argv[i + 1]] : []),
    eq(n, def) {
      const p = name(n) + '=';
      const a = argv.find((x) => x.startsWith(p));
      return a === undefined ? def : a.slice(p.length);
    },
    positional: () => argv.filter((a) => !a.startsWith('--')),
    die: (prefix) => (msg) => { console.error(prefix + ': ' + msg); process.exit(2); },
  };
}

/**
 * Все `--имя` разом в объект. Повтор — побеждает последний.
 *   greedy: false (по умолчанию) — флаг без значения (следующего нет или оно флаг) получает `true`
 *     и не проглатывает соседний аргумент;
 *   greedy: true — следующее слово всегда значение флага (даже `--x`); последний флаг без значения — `undefined`.
 */
function parseOptions(argv, { greedy = false } = {}) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const name = argv[i].slice(2);
    const next = argv[i + 1];
    if (greedy) { out[name] = next; i++; }
    else if (next === undefined || next.startsWith('--')) out[name] = true;
    else { out[name] = next; i++; }
  }
  return out;
}

/**
 * Разбор по списку известных флагов: `{ '--prompt': 'prompt', '--max-tokens': ['maxTokens', (v) => parseInt(v, 10)] }`.
 * Известный флаг берёт следующее слово как есть; незнакомое слово пропускается на один шаг — значение
 * незнакомого флага само разбирается как слово (так читал прежний разбор внешней модели).
 * Возвращает `target`, дополненный найденным.
 */
function parseKnown(argv, spec, target = {}) {
  for (let i = 0; i < argv.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(spec, argv[i])) continue;
    const s = spec[argv[i]];
    const [key, convert] = Array.isArray(s) ? s : [s];
    const raw = argv[++i];
    target[key] = convert ? convert(raw) : raw;
  }
  return target;
}

/**
 * Слова вида `--ключ=значение` и `--ключ значение` в объект; `booleans` — флаги без значения; остальное — `rest`.
 * Ключ и значение — строки; `--ключ` последним словом даёт `undefined`.
 */
function parseLong(argv, booleans = []) {
  const opts = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) { rest.push(argv[i]); continue; }
    if (booleans.includes(m[1])) { opts[m[1]] = true; continue; }
    opts[m[1]] = m[2] !== undefined ? m[2] : argv[++i];
  }
  return { opts, rest };
}

module.exports = { makeCli, parseOptions, parseKnown, parseLong };
