#!/usr/bin/env node
// Сухожилия: слой связей между тремя графами.
//
// Скелет — движок (`.forma/manual/`), мышцы — проект (`project/`), сухожилия — опыт
// (`.devtool/features/done/`). Сухожилие крепится двумя концами: к правилу, которое
// урок обкатал, и к делу, на котором это случилось. Без костного конца урок —
// дневник, без мышечного — теория; обе вырожденности бесполезны для переноса.
//
// Крепления не извлекаются моделью: они уже написаны в карточках прозой. Здесь
// только сопоставление имён, поэтому прогон ничего не стоит и повторяется сколько
// угодно раз.
//
// Цепляемся к самим карточкам, а не к графу опыта: граф — одно из изображений
// карточек, он может отставать, а карточки на диске всегда свежие.
//
//   node .claude/scripts/build-tendons.cjs [--out <файл>]
'use strict';

const fs = require('fs');
const path = require('path');
const { makeCli } = require('../../.forma/dashboard/lib/cli.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const MANUAL = path.join(ROOT, '.forma/living', 'graphs', '.forma/manual', 'graph.json');
const PROJECT = path.join(ROOT, '.forma/living', 'graphs', 'project', 'graph.json');
// Граф движка — необязательный вход (build-engine-meaning.cjs, слой смысла):
// нет файла или в нём нет description/capabilities — секция «движок → правило»
// просто пустая, это не повод останавливать сухожилия карточек.
const ENGINE = path.join(ROOT, '.forma/living', 'graphs', 'engine', 'graph.json');
const CARDS_DIR = path.join(ROOT, '.devtool', 'features', 'done');
const LAW = path.join(ROOT, 'AGENTS.md');
// Тот же закон по-русски: граф движка построен из этого корпуса, и имена узлов
// взяты отсюда же — значит сопоставлять надо с ним, а не с английским подлинником.
const LAW_RU = path.join(ROOT, '.forma/manual', 'PROTOCOL.md');

const OUT = makeCli().value('out', path.join(ROOT, '.forma/living', 'graphs', 'tendons.json'));

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

// --- запреты закона -------------------------------------------------------------
// Карточка пишет «запрет 7», а узел графа зовётся полной формулировкой. Номера
// берём из самого закона, а не из головы: список там нумерован и это его адрес.
function prohibitions() {
  const out = new Map();   // номер → формулировка
  let text, marker;
  try { text = fs.readFileSync(LAW_RU, 'utf8'); marker = '## Нельзя'; }
  catch { text = null; }
  if (!text || !text.includes(marker)) {
    try { text = fs.readFileSync(LAW, 'utf8'); marker = '## 5. Prohibitions'; }
    catch { return out; }
  }
  const block = text.split(marker)[1];
  if (!block) return out;
  for (const line of block.split(/\r?\n/)) {
    const m = /^(\d+)\.\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    out.set(Number(m[1]), m[2]);
    if (Number(m[1]) === 15) break;
  }
  return out;
}

// --- синонимы имени узла --------------------------------------------------------
// Дословное совпадение недосчитывает вдвое: узел зовётся «Снаряжение (Kit)», а
// карточка пишет `Kit`. Синонимы выводятся из самого имени, не сочиняются.
function aliases(label) {
  const out = new Set();
  const en = /\(([A-Z][A-Za-z]+)\)/.exec(label);
  if (en) {
    out.add('`' + en[1] + '`');        // так узел зовут в карточках
    out.add(en[1].toLowerCase() + '.md');  // и так зовут его файл роли
  }
  // Имя без уточнения в скобках: «Кэш круга (§9)» → «Кэш круга».
  const bare = label.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (bare && bare !== label && bare.length >= 6) out.add(bare);
  return [...out];
}

// Слово целиком, а не кусок другого слова. Границы \b по-русски не работают
// (они считают кириллицу не-буквой), поэтому смотрим соседние знаки сами.
const LETTER = /[\p{L}\p{N}_]/u;
function mentions(text, needle) {
  if (!needle || needle.length < 4) return 0;
  let n = 0, i = 0;
  while ((i = text.indexOf(needle, i)) !== -1) {
    const before = text[i - 1] || ' ';
    const after = text[i + needle.length] || ' ';
    const openWord = LETTER.test(needle[0]);
    const closeWord = LETTER.test(needle[needle.length - 1]);
    if ((!openWord || !LETTER.test(before)) && (!closeWord || !LETTER.test(after))) n++;
    i += needle.length;
  }
  return n;
}

function loadCards() {
  return fs.readdirSync(CARDS_DIR).filter((f) => f.endsWith('.md'))
    .map((f) => ({
      file: '.devtool/features/done/' + f,
      code: (/^(card-\d+)/.exec(f) || [])[1] || f.replace(/\.md$/, ''),
      text: fs.readFileSync(path.join(CARDS_DIR, f), 'utf8'),
    }));
}

// Файлы проекта, названные в карточке, — мышечный конец. Узел графа проекта
// привязан к своему source_file, по нему и цепляем.
function projectFileIndex(project) {
  const projectFiles = new Map();
  for (const n of project.nodes) {
    if (!n.source_file) continue;
    if (!projectFiles.has(n.source_file)) projectFiles.set(n.source_file, []);
    projectFiles.get(n.source_file).push(n.id);
  }
  return projectFiles;
}

// Понятия графа движка: имя узла и его синонимы, найденные в тексте карточек.
function matchBones(manual, cards, toBone, boneHits) {
  for (const node of manual.nodes) {
    const label = node.label || '';
    if (label.length < 6) continue;
    const needles = [label, ...aliases(label)];
    for (const c of cards) {
      let weight = 0;
      const via = [];
      for (const nd of needles) {
        const k = mentions(c.text, nd);
        if (k) { weight += k; via.push(nd); }
      }
      if (weight) {
        toBone.push({ card: c.code, file: c.file, node: node.id, label, weight, via });
        boneHits.set(node.id, (boneHits.get(node.id) || 0) + weight);
      }
    }
  }
}

// Запрет — самостоятельная кость, а не чей-то узел. Подбор хозяина среди понятий
// графа по общим словам давал правдоподобный мусор: запрет 8 повисал на «Intent
// снаряжается человеком», запрет 14 — на «Одинаковый тир не означает одного
// агента». Уверенная связь не туда хуже её отсутствия. У запрета есть номер и
// формулировка; этого довольно, чтобы быть костью самому.
function matchProhibitions(proh, cards, toBone, boneHits) {
  for (const [num, wording] of proh) {
    const needle = 'запрет ' + num;
    const id = 'запрет-' + num;
    for (const c of cards) {
      const k = mentions(c.text.toLowerCase(), needle);
      if (!k) continue;
      toBone.push({ card: c.code, file: c.file, node: id,
                    label: 'Запрет ' + num + ' · ' + wording,
                    weight: k, via: [needle], prohibition: num });
      boneHits.set(id, (boneHits.get(id) || 0) + k);
    }
  }
}

// --- движок → правило: «реализует правило» (слой смысла, не код) -----------------
// Текст сопоставления — description+capabilities узла-файла (build-engine-meaning.cjs),
// не исходный код: совпадение по смыслу, та же логика мест, что matchBones/matchProhibitions,
// но источник — файлы движка, а не карточки.
function engineFiles(engine) {
  if (!engine) return [];
  return engine.nodes.filter((n) => n.type === 'file' && (n.description || (n.capabilities && n.capabilities.length)));
}

function matchEngineBones(engine, manual, proh, toBoneEngine) {
  const files = engineFiles(engine);
  if (!files.length) return;
  for (const node of manual.nodes) {
    const label = node.label || '';
    if (label.length < 6) continue;
    const needles = [label, ...aliases(label)];
    for (const f of files) {
      const text = [f.description || '', ...(f.capabilities || [])].join(' ');
      let weight = 0;
      const via = [];
      for (const nd of needles) {
        const k = mentions(text, nd);
        if (k) { weight += k; via.push(nd); }
      }
      if (weight) toBoneEngine.push({ file: f.source_file, node: node.id, label, weight, via, relation: 'implements_rule' });
    }
  }
  for (const [num, wording] of proh) {
    const needle = 'запрет ' + num;
    const id = 'запрет-' + num;
    for (const f of files) {
      const text = [f.description || '', ...(f.capabilities || [])].join(' ').toLowerCase();
      const k = mentions(text, needle);
      if (!k) continue;
      toBoneEngine.push({ file: f.source_file, node: id, label: 'Запрет ' + num + ' · ' + wording,
                           weight: k, via: [needle], prohibition: num, relation: 'implements_rule' });
    }
  }
}

function matchMuscles(cards, projectFiles) {
  const toMuscle = [];
  for (const c of cards) {
    for (const [src, ids] of projectFiles) {
      if (!c.text.includes(src)) continue;
      toMuscle.push({ card: c.code, file: c.file, source_file: src, nodes: ids });
    }
    // Цель — тоже мышечный конец, и она называется прямо.
    for (const m of c.text.matchAll(/goal-(\d+)/g)) {
      toMuscle.push({ card: c.code, file: c.file, source_file: 'goal-' + m[1], nodes: [] });
    }
  }
  return toMuscle;
}

function countBothEnds(toBone, toMuscle) {
  const byCard = new Map();
  const ends = (card) => byCard.get(card) || byCard.set(card, { bone: 0, muscle: 0 }).get(card);
  for (const t of toBone) ends(t.card).bone++;
  for (const t of toMuscle) ends(t.card).muscle++;
  return [...byCard.values()].filter((v) => v.bone && v.muscle).length;
}

// Сколько разных карточек коснулось правила — честнее, чем сколько раз его
// назвали: одна карточка, помянувшая `Kit` тридцать раз, обкатала его однажды.
function cardsPerRule(toBone) {
  const sets = new Map();
  for (const t of toBone) {
    if (!sets.has(t.node)) sets.set(t.node, new Set());
    sets.get(t.node).add(t.card);
  }
  return new Map([...sets].map(([id, set]) => [id, set.size]));
}

// Понятия — это и есть закон. Документы (AGENTS.md, PROJECT.md) — адреса, где
// он лежит; их упоминание не говорит, что правило обкатано.
function wearTables(manual, toBone, boneHits) {
  const kind = new Map(manual.nodes.map((n) => [n.id, n.file_type]));
  const label = new Map(manual.nodes.map((n) => [n.id, n.label]));
  // Запреты — кости без узла в графе: их имя приходит с самим креплением.
  for (const t of toBone) if (!label.has(t.node)) label.set(t.node, t.label);
  const cardsPer = cardsPerRule(toBone);
  return {
    wear: [...boneHits.entries()]
      .filter(([id]) => kind.get(id) !== 'document')   // запреты сюда входят: у них типа нет
      .map(([id, weight]) => ({ node: id, label: label.get(id) || id, weight, cards: cardsPer.get(id) || 0 }))
      .sort((a, b) => b.cards - a.cards || b.weight - a.weight),
    addresses: [...boneHits.entries()]
      .filter(([id]) => kind.get(id) === 'document')
      .map(([id, weight]) => ({ node: id, label: label.get(id) || id, weight }))
      .sort((a, b) => b.weight - a.weight),
  };
}

// Итоговый файл: три корпуса, счётчики, износ правил, голые понятия и сами крепления.
function assembleReport(src, toBone, toMuscle, boneHits, toBoneEngine) {
  const { manual, project, cards, proh, engine } = src;
  const engFiles = engineFiles(engine);
  // Правило, которого ни одна карточка не коснулась. Это не приговор ему: либо
  // оно безупречно, либо ни разу не проверено, и одно от другого отличает то,
  // заходили ли карточки в эту область вообще.
  // Голым считается только понятие: документ не бывает «необкатанным».
  const bare = manual.nodes
    .filter((n) => n.file_type !== 'document' && !boneHits.has(n.id))
    .map((n) => n.label);
  return {
    built: new Date().toISOString(),
    corpora: {
      bone: { source: '.forma/manual/', nodes: manual.nodes.length },
      tendon: { source: '.devtool/features/done/', cards: cards.length },
      muscle: { source: 'project/', nodes: project.nodes.length },
    },
    totals: {
      toBone: toBone.length,
      toMuscle: toMuscle.length,
      cardsWithBothEnds: countBothEnds(toBone, toMuscle),
      cardsTotal: cards.length,
      bonesTouched: manual.nodes.filter((n) => n.file_type !== 'document' && boneHits.has(n.id)).length,
      prohibitionsTotal: proh.size,
      prohibitionsTouched: [...boneHits.keys()].filter((id) => /^запрет-/.test(id)).length,
      bonesBare: bare.length,
      conceptsTotal: manual.nodes.filter((n) => n.file_type !== 'document').length,
    },
    ...wearTables(manual, toBone, boneHits),
    bare,
    toBone,
    toMuscle,
    engine: {
      source: '.forma/living/graphs/engine/graph.json',
      filesTotal: engine ? engine.nodes.filter((n) => n.type === 'file').length : 0,
      filesWithMeaning: engFiles.length,
      rulesImplemented: new Set(toBoneEngine.map((t) => t.node)).size,
    },
    toBoneEngine,
  };
}

function printSummary(out) {
  const t = out.totals;
  console.log('Сухожилия построены:', path.relative(ROOT, OUT));
  console.log('  к кости:', t.toBone, '| к мышце:', t.toMuscle);
  console.log('  карточек обоими концами:', t.cardsWithBothEnds, 'из', out.corpora.tendon.cards);
  console.log('  понятий обкатано:', t.bonesTouched, 'из', t.conceptsTotal,
              '| голых:', t.bonesBare);
  console.log('  запретов обкатано:', t.prohibitionsTouched, 'из', t.prohibitionsTotal);
  console.log('  плотнее всего:', out.wear.slice(0, 3).map((w) => w.label.slice(0, 32) + ' (' + w.cards + ')').join(' · '));
  const e = out.engine;
  if (e.filesWithMeaning) {
    console.log('  движок → правило: файлов со слоем смысла', e.filesWithMeaning, 'из', e.filesTotal,
                '| правил «реализует» затронуто', e.rulesImplemented, '| рёбер', out.toBoneEngine.length);
  } else {
    console.log('  движок → правило: нет слоя смысла (.forma/living/graphs/engine/graph.json без description/capabilities) — секция пустая.');
  }
}

function loadEngine() {
  try { return readJson(ENGINE); } catch { return null; }
}

function main() {
  const src = { manual: readJson(MANUAL), project: readJson(PROJECT), proh: prohibitions(), cards: loadCards(), engine: loadEngine() };
  const toBone = [];     // карточка → правило движка
  const boneHits = new Map();
  matchBones(src.manual, src.cards, toBone, boneHits);
  matchProhibitions(src.proh, src.cards, toBone, boneHits);
  const toMuscle = matchMuscles(src.cards, projectFileIndex(src.project));   // карточка → файл проекта
  const toBoneEngine = [];   // файл движка → правило («реализует правило»)
  matchEngineBones(src.engine, src.manual, src.proh, toBoneEngine);

  const out = assembleReport(src, toBone, toMuscle, boneHits, toBoneEngine);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
  printSummary(out);
}

main();
