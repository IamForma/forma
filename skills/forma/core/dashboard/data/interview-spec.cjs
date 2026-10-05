'use strict';

/**
 * The interview structure: five positions and the opening questions. Order, names and structure come from
 * `project/brief/interview.md`, the default script. The skeleton exists always, before the first answer:
 * the tab shows not emptiness but what will be asked, so the human can collect their thoughts in advance.
 *
 * Two layers, kept apart:
 *  - STRUCTURE (`POSITIONS`): `name` is the canonical machine key — it is matched against the headings of
 *    `picture.md` and `interview.md`, so it never changes with the language; `asks`, `deps`, layer keys too.
 *  - COPY (`COPY.en` / `COPY.ru`): everything the human reads — display label, hint, note, questions. The
 *    language is the project language (`project/config/PROJECT.md`, «Project language»); English is the source,
 *    Russian the official second.
 *
 * `asks` — who is asked. For position 5 it is `intent`: the route is not a question to the human but the
 * node's reconnaissance (check against `project/config/ROUTE.md`; the branch is set by the «Project template»
 * field in `PROJECT.md`). It has no «answer» button — otherwise the human would be asked to do the node's work.
 *
 * `deps` — the frontier: a position is open when its prerequisites have settled. The third cannot be asked
 * until the second has named the parts — «which common goal do the parts serve together» without parts makes the
 * human guess at what they never said. The first and second open at once: they give the look and the breakdown
 * and neither waits for the other.
 *
 * `layers` — positions 3 and 4 have two each: the human layer — what the recipient will feel, the subject layer —
 * by what functionality it is produced. One without the other degenerates: a feeling without functionality is a
 * promise, functionality without a feeling is work for no known reason. For the talk it also means there are
 * seven rounds, not five, and each is smaller.
 *
 * Names on screen face the subject. The internal names of the qualities (Beauty, Simplicity, Individuality,
 * Honesty, Naturalness) are not brought out here: a question must not announce which quality it is after,
 * otherwise the human starts answering categories instead of about their own project.
 */
const i18n = require('../../i18n/index.cjs');

const POSITIONS = [
  { n: 1, name: 'Облик', asks: 'human', deps: [] },
  { n: 2, name: 'Части', asks: 'human', deps: [] },
  { n: 3, name: 'Общая цель частей', asks: 'human', deps: [2], layers: ['human', 'subject'] },
  { n: 4, name: 'Внутренняя функциональность', asks: 'human', deps: [3], layers: ['human', 'subject'] },
  { n: 5, name: 'Маршрут', asks: 'intent', deps: [4] },
];

// Opening-round questions per position. Open, no options to pick: options are invented by the agent, and a poll
// with ready options would write into the brief its own design approved by the human instead of the human's design —
// and unnoticed, since formally «the human said it: they clicked». Options appear from the second round
// and are built from what has already been said (`project/brief/picture.md`).
//
// Rounds of positions 3-5 are intentionally empty. A question composed before the previous answer is heard asks about
// an imagined project; they are written together with the human when their turn comes.
// Position 2 asks about the parts of the subject itself, not the sections of the catalog:
// the eight directions are its content, the parts are what it is assembled from.
const COPY = {
  en: {
    positions: {
      1: { label: 'Look', hint: 'What the project looks like from outside, what form it has.' },
      2: { label: 'Parts', hint: 'What separate parts it divides into.' },
      3: {
        label: 'Common goal of the parts',
        hint: 'The one common goal all the parts serve together.',
        layers: {
          human: { label: 'human', hint: 'What benefit a slice of the audience gets — what the person will feel.' },
          subject: { label: 'subject', hint: 'What functionality produces it so that they are satisfied.' },
        },
      },
      4: {
        label: 'Inner functionality',
        hint: 'What functions the project performs inside itself to deliver what position 3 names.',
        layers: {
          human: { label: 'human', hint: 'What it is done for, care about how it will turn out.' },
          subject: { label: 'subject', hint: 'What functions carry it out — what `Run` will do.' },
        },
      },
      5: {
        label: 'Route',
        hint: 'The natural way all of this is finally realized.',
        note: 'Checking against `project/config/ROUTE.md` is the work of `Intent`, not a question to the human.',
      },
    },
    rounds: {
      1: [
        { id: 'p1-q1', title: 'First screen',
          text: 'The project already works. You show it to someone who knows nothing about it — open it and let them look. What do they see in front of them?' },
        { id: 'p1-q2', title: 'What it resembles',
          text: 'Name one or two existing things this resembles. And at once — how yours differs from them.' },
        { id: 'p1-q3', title: 'What shows, what is hidden',
          text: 'What should catch the eye first? And what, on the contrary, should be unnoticed, go deep inside?' },
      ],
      2: [
        { id: 'p2-q1', title: 'What it is assembled from',
          text: 'Take the project apart, the way one takes a thing apart. Not the sections of the catalog — we already know them — but the pieces of the site itself: each with its own job. What is separate in there?' },
        { id: 'p2-q2', title: 'What can be removed',
          text: 'If you had to launch without one part — which would you drop first? And what would stop working after that.' },
        { id: 'p2-q3', title: 'Who is busy with what',
          text: 'Name a part that works by itself, without you. And a part that does not work at all without your participation.' },
      ],
    },
    resume: {
      title: 'What else to discuss',
      text: 'This position was closed, but not closed forever. What would you like to add, correct or discuss anew? One word is enough — I will unfold it with questions.',
    },
    grow: { title: 'In more detail', text: 'In the tree this is recorded as: «{label}». Unfold this item: what stands behind it, what it looks like in practice, what it lacks. Then I will go on with questions about your answer.' },
    seed: { note: 'The first round is open: answer in your own words. You may skip some.', question: 'Question {n}', topic: 'Brief interview — position {n}' },
  },
  ru: {
    positions: {
      1: { label: 'Облик', hint: 'Что проект собой представляет внешне, какую форму имеет.' },
      2: { label: 'Части', hint: 'На какие отдельные части он делится.' },
      3: {
        label: 'Общая цель частей',
        hint: 'Какую одну общую цель все части выполняют вместе.',
        layers: {
          human: { label: 'человек', hint: 'Какую пользу получает срез аудитории — что человек почувствует.' },
          subject: { label: 'предмет', hint: 'Какой функционал это производит, чтобы он был удовлетворён.' },
        },
      },
      4: {
        label: 'Внутренняя функциональность',
        hint: 'Какие функции проект выполняет внутри себя, чтобы дать названное в позиции 3.',
        layers: {
          human: { label: 'человек', hint: 'Ради чего это делается, забота о том, что получится.' },
          subject: { label: 'предмет', hint: 'Какие функции это исполняют — то, что будет делать `Run`.' },
        },
      },
      5: {
        label: 'Маршрут',
        hint: 'Каким естественным способом всё это в конечном счёте реализуется.',
        note: 'Сверка с `project/config/ROUTE.md` — работа `Intent`, не вопрос человеку.',
      },
    },
    rounds: {
      1: [
        { id: 'p1-q1', title: 'Первый экран',
          text: 'Проект уже работает. Вы показываете его человеку, который о нём ничего не знает, — открываете и даёте посмотреть. Что он видит перед собой?' },
        { id: 'p1-q2', title: 'На что похоже',
          text: 'Назовите одну-две уже существующие вещи, на которые это похоже. И сразу — чем ваше от них отличается.' },
        { id: 'p1-q3', title: 'Что видно, что спрятано',
          text: 'Что в нём должно бросаться в глаза первым? И что, наоборот, должно быть незаметным, уйти вглубь?' },
      ],
      2: [
        { id: 'p2-q1', title: 'Из чего собрано',
          text: 'Разберите проект на части, как разбирают вещь. Не разделы каталога — их мы уже знаем, — а куски самого сайта: у каждого своё дело. Что там есть отдельного?' },
        { id: 'p2-q2', title: 'Что можно убрать',
          text: 'Если бы пришлось запуститься без одной части — какую убрали бы первой? И что после этого перестало бы работать.' },
        { id: 'p2-q3', title: 'Кто чем занят',
          text: 'Назовите часть, которая работает сама, без вас. И часть, которая без вашего участия не работает вообще.' },
      ],
    },
    resume: {
      title: 'Что ещё обсудить',
      text: 'Эта позиция была закрыта, но закрыта не навсегда. Что вы хотели бы добавить, поправить или обсудить заново? Можно одним словом — дальше раскручу вопросами.',
    },
    grow: { title: 'Подробнее', text: 'В дереве это записано так: «{label}». Раскройте этот пункт: что за ним стоит, как он выглядит на деле, чего в нём не хватает. Дальше пойду вопросами по вашему ответу.' },
    seed: { note: 'Первый заход открытый: отвечайте своими словами. Можно ответить не на все.', question: 'Вопрос {n}', topic: 'Интервью к брифу — позиция {n}' },
  },
};

/** Project language → copy set: «Russian» → `ru`, anything else → `en` (the source language). */
function langOf(projectMd) {
  const word = (i18n.reader(projectMd).inline('language') || '').split(/\s+/)[0];
  return i18n.langCode(word) === 'ru' ? 'ru' : 'en';
}

/** Positions with copy merged in (`label`, `hint`, `note`, layers with `label`/`hint`) and the opening rounds. */
function localize(lang) {
  const c = COPY[lang] || COPY.en;
  const positions = POSITIONS.map((p) => {
    const t = c.positions[p.n];
    const spec = { ...p, label: t.label, hint: t.hint };
    if (t.note) spec.note = t.note;
    if (p.layers) spec.layers = p.layers.map((key) => ({ key, label: t.layers[key].label, hint: t.layers[key].hint }));
    return spec;
  });
  return { POSITIONS: positions, OPENING_ROUND: c.rounds, resume: c.resume, seed: c.seed, grow: c.grow };
}

module.exports = { POSITIONS, OPENING_ROUND: COPY.en.rounds, COPY, langOf, localize };
