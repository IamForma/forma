// Выводы движка на фикстуре, приведённые к виду, не зависящему от машины:
// пути корня и HOME — маркерами, дата создания карточки — маркером, переводы строк — LF.
const { runNode } = require('./fixture.cjs');
const { snapshot } = require('./snapshot.cjs');

const slash = (s) => s.split('\\').join('/');

function clean(text, fx) {
  let out = text.split('\r\n').join('\n');
  for (const [from, to] of [[fx.root, '<ROOT>'], [slash(fx.root), '<ROOT>'], [fx.home, '<HOME>'], [slash(fx.home), '<HOME>']]) {
    out = out.split(from).join(to);
  }
  return out;
}

function run(fx, args) {
  const r = runNode(fx, args);
  return { status: r.status, out: clean((r.stdout || '') + (r.stderr || ''), fx) };
}

const NEW_CARD_ARGS = ['.forma/board/new-card.cjs', '--kind', 'forma', '--title', 'Проба сетки', '--route', '4', '--dry'];

function newCardDry(fx) {
  const r = run(fx, NEW_CARD_ARGS);
  return { status: r.status, out: slash(r.out).replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<now>') };
}

// Всё, что сравнивается «до/после» рефакторинга: имя → текст.
function collect(fx) {
  const board = run(fx, ['.forma/board/check-board.cjs']);
  const sync = run(fx, ['.claude/scripts/sync-engines.cjs', '--check']);
  const card = newCardDry(fx);
  return {
    'build-data.json': snapshot(fx),
    'check-board.txt': `exit ${board.status}\n${board.out}`,
    'sync-engines-check.txt': `exit ${sync.status}\n${sync.out}`,
    'new-card-dry.txt': `exit ${card.status}\n${card.out}`,
  };
}

module.exports = { run, newCardDry, collect, NEW_CARD_ARGS };
