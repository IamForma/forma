'use strict';

/**
 * Живая картина проекта во время интервью к брифу — вкладка «Интервью». Источник правды —
 * `project/brief/picture.json` (пишет `Intent`, файлы — `interview-files.cjs`); устройство позиций и вопросы
 * первого захода — `interview-spec.cjs`. Файла нет — интервью не идёт; вкладка отдаёт скелет и причину.
 */

const { POSITIONS, langOf, localize } = require('./interview-spec.cjs');
const { projectFile, readIfExists } = require('../lib/fs.cjs');
const { readIdea, readLandingPrompt, readPictureText, readAnswers, sessionInfo } = require('./interview-files.cjs');

/**
 * Состояние позиции считается здесь, а не пишется в файл: оно целиком выводится из ответов и зависимостей,
 * и второй записи о нём быть не должно — разошлись бы. `st`: `answered` — кто отвечен, `own` — запись позиции
 * из картины, `submitted` — человек отправил ответ, `questions` — вопросы захода.
 */
function positionState(spec, st) {
  const { answered, own, submitted } = st;
  // Отвеченность позиции — факт о её вопросах, а не моя отметка о ней. Пока хоть один вопрос захода открыт,
  // позиция в работе: пометив её отвеченной раньше, я закрываю человеку вход туда, где он ещё не договорил.
  const qs = st.questions || [];
  const asked = qs.length;
  const got = qs.filter((q) => q.given).length;
  if (asked && got && got < asked) return 'partial';
  if (own && own.state === 'answered') return asked && got < asked ? 'partial' : 'answered';
  const depsReady = spec.deps.every((d) => answered.has(d));
  if (spec.asks === 'intent') return depsReady ? 'ready' : 'blocked';
  // Человек ответил, `Intent` ещё не разобрал. Отдельное состояние, а не «отвечено»: ответ есть, картины по
  // нему ещё нет, и выдать одно за другое значило бы показать работу сделанной раньше, чем она сделана.
  if (submitted && !(own && own.text)) return 'sent';
  if (own && own.state === 'now') return 'now';
  return depsReady ? 'available' : 'blocked';
}

/** Что сказано и где спрашивают: последняя отправка по вопросу берёт верх (файл дописывается, не переписывается). */
function answerContext(projectRoot) {
  const answers = readAnswers(projectRoot);
  const givenBy = new Map();
  for (const rec of answers) {
    for (const a of rec.answers || []) givenBy.set(a.id, { text: a.text, at: rec.at });
  }
  // Текст, который читает человек, — на языке проекта; машинные ключи позиций (`name`) от языка не зависят.
  const loc = localize(langOf(readIfExists(projectFile(projectRoot, 'PROJECT.md'))));
  return { sentFor: new Set(answers.map((o) => o.position)), sessions: sessionInfo(projectRoot), givenBy, loc };
}

const sessionOf = (ctx, spec) => (ctx.sessions[spec.n] && { url: ctx.sessions[spec.n].url, alive: ctx.sessions[spec.n].alive }) || null;

/** Вопросы позиции: сессия открыта — спрошено то, что в ней; нет — то, чем её засеют. */
function questionsFor(spec, ctx) {
  const sess = ctx.sessions[spec.n] || null;
  const source = (sess && sess.questions && sess.questions.length) ? sess.questions : (ctx.loc.OPENING_ROUND[spec.n] || []);
  return source.map((q) => ({ ...q, given: ctx.givenBy.get(q.id) || null }));
}

function emptyLayers(spec) {
  return (spec.layers || []).map((l) => ({ key: l.key, label: l.label, hint: l.hint, text: null, answered: false }));
}

function emptyPosition(spec, ctx) {
  // Состояние скелета считается по вопросам как они есть, без ответов человека: отвечать тут ещё нечему.
  const rawQuestions = (ctx.sessions[spec.n] && ctx.sessions[spec.n].questions) || ctx.loc.OPENING_ROUND[spec.n] || [];
  return {
    n: spec.n, name: spec.name, label: spec.label, asks: spec.asks, hint: spec.hint,
    note: spec.note || null, deps: spec.deps,
    waitingFor: spec.deps.slice(),
    state: positionState(spec, { answered: new Set(), own: null, submitted: ctx.sentFor.has(spec.n), questions: rawQuestions }),
    session: sessionOf(ctx, spec),
    questions: questionsFor(spec, ctx),
    fill: 0, text: null,
    layers: emptyLayers(spec),
    guess: null,
  };
}

/**
 * Скелет без единого ответа. Отдельной веткой, а не readInterview(null), чтобы пустое состояние нельзя
 * было случайно отличить по форме от заполненного.
 */
function emptyPicture(projectRoot) {
  const ctx = answerContext(projectRoot);
  return {
    topic: null, round: null, updated: null, finished: null, tree: null,
    idea: readIdea(projectRoot),
    landingPrompt: readLandingPrompt(projectRoot),
    answered: 0,
    guesses: { open: 0, confirmed: 0, rejected: 0 },
    positions: ctx.loc.POSITIONS.map((spec) => emptyPosition(spec, ctx)),
  };
}

function countStatus(acc, status) {
  const st = status || 'open';
  if (st === 'open') acc.open += 1;
  else if (st === 'confirmed') acc.confirmed += 1;
  else if (st === 'rejected') acc.rejected += 1;
}

function countGuesses(node, acc) {
  if (!node) return acc;
  if (node.kind === 'guess') countStatus(acc, node.status);
  for (const child of node.children || []) countGuesses(child, acc);
  return acc;
}

/** Догадки дерева и догадки позиций — открытые, подтверждённые, отвергнутые. */
function guessTotals(tree, positions) {
  const guesses = countGuesses(tree, { open: 0, confirmed: 0, rejected: 0 });
  for (const p of positions) {
    if (p.guess) countStatus(guesses, p.guess.status);
  }
  return guesses;
}

function liveLayers(spec, own) {
  return (spec.layers || []).map((l) => {
    const got = ((own && own.layers) || {})[l.key] || null;
    return { key: l.key, label: l.label, hint: l.hint, text: got && got.text ? got.text : null, answered: Boolean(got && got.text) };
  });
}

function livePosition(spec, own, answered, ctx) {
  const qs = questionsFor(spec, ctx);
  const state = positionState(spec, { answered, own, submitted: ctx.sentFor.has(spec.n), questions: qs });
  return {
    n: spec.n,
    name: spec.name,
    label: spec.label,
    asks: spec.asks,
    hint: spec.hint,
    note: spec.note || null,
    deps: spec.deps,
    // Чего именно ждёт закрытая позиция — называется вслух, иначе она читается как сломанная, а не как
    // ждущая своей очереди.
    waitingFor: state === 'blocked' ? spec.deps.filter((d) => !answered.has(d)) : [],
    state, // answered | now | sent | available | blocked | ready (у пятой)
    session: sessionOf(ctx, spec),
    questions: qs,
    fill: typeof (own && own.fill) === 'number'
      ? Math.max(0, Math.min(100, own.fill))
      : (state === 'answered' ? 100 : 0),
    text: (own && own.text) || null,
    layers: liveLayers(spec, own),
    guess: (own && own.guess) || null,
  };
}

/** Кто отвечен. Два прохода: состояние позиции зависит от соседей, и в один проход смотрели бы на ещё не заполненное. */
function answeredPositions(byName) {
  const answered = new Set();
  for (const spec of POSITIONS) {
    const own = byName.get(spec.name);
    if (own && own.state === 'answered') answered.add(spec.n);
  }
  return answered;
}

function livePicture(projectRoot, data) {
  const byName = new Map((data.positions || []).map((p) => [p.name, p]));
  const ctx = answerContext(projectRoot);
  const answered = answeredPositions(byName);
  const positions = ctx.loc.POSITIONS.map((spec) => livePosition(spec, byName.get(spec.name) || null, answered, ctx));
  const tree = data.tree || null;
  return {
    present: true,
    topic: data.topic || null,
    round: typeof data.round === 'number' ? data.round : null,
    updated: data.updated || null,
    finished: data.finished || null,
    positions,
    answered: positions.filter((p) => p.state === 'answered').length,
    tree,
    idea: readIdea(projectRoot),
    landingPrompt: readLandingPrompt(projectRoot),
    guesses: guessTotals(tree, positions),
  };
}

function readInterview(projectRoot) {
  const raw = readPictureText(projectRoot);
  // Файла нет — интервью не идёт, но скелет всё равно отдаётся: пустая вкладка ничего не говорит,
  // а скелет говорит, о чём спросят.
  if (raw === null) return { present: false, reason: 'no-file', ...emptyPicture(projectRoot) };
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    // Разбитый JSON — не то же, что отсутствующий: во втором случае интервью не идёт, в первом оно идёт
    // и картина сломана. Молча показать «пусто» значило бы выдать поломку за покой.
    return { present: false, reason: 'bad-json', error: String((err && err.message) || err), ...emptyPicture(projectRoot) };
  }
  return livePicture(projectRoot, data);
}

module.exports = { readInterview };
