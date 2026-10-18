'use strict';

/**
 * Файлы живого интервью в `project/brief/`: картина (`picture.json`), дословные ответы (`answers.jsonl`),
 * изложение (`idea.md`), промпт первой страницы, карта живых сессий (`sessions.json`, читается модулем `lib/interview-sessions.cjs`).
 * Картину пишет `Intent` по раунду ответов, а не дашборд: клик человека меняет статус догадки и больше
 * ничего (`serve.js`, /interview/decide). Файла нет — интервью не идёт; это не ошибка.
 */

const fs = require('fs');
const path = require('path');
const { readIfExists } = require('../lib/fs.cjs');
const { positionSessions, serverOf } = require('../lib/interview-sessions.cjs');

const PICTURE_PATH = ['project', 'brief', 'picture.json'];
// Дословные ответы человека — отдельный файл от картины, и это не мелочь: «сказанное человеком» и «понятое
// агентом» не должны лежать в одном месте под одним именем. Дописывается строками, не переписывается.
const ANSWERS_PATH = ['project', 'brief', 'answers.jsonl'];
// Связное изложение того, чем проект является сейчас. Пишет `Intent`, целиком заново после каждого разбора.
const IDEA_PATH = ['project', 'brief', 'idea.md'];
// Промпт первой страницы: пишется по ходу интервью, как idea.md (`forma-grill-with-ui`).
const LANDING_PROMPT_PATH = ['project', 'brief', 'landing-prompt.md'];

const briefFile = (projectRoot, parts) => path.join(projectRoot, ...parts);

/** Текст файла или `null`: ещё не написан — это нормально, не ошибка. */
const readIdea = (projectRoot) => readIfExists(briefFile(projectRoot, IDEA_PATH), null);
const readLandingPrompt = (projectRoot) => readIfExists(briefFile(projectRoot, LANDING_PROMPT_PATH), null);

/** Картина как текст; файла нет — `null`. */
const readPictureText = (projectRoot) => readIfExists(briefFile(projectRoot, PICTURE_PATH), null);

/** Ответы человека по строкам JSONL. Битая строка не роняет остальные: одна испорченная запись не прячет прежние. */
function readAnswers(projectRoot) {
  const raw = readIfExists(briefFile(projectRoot, ANSWERS_PATH), null);
  if (raw === null) return [];
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      // Битая строка не роняет остальные: файл дописывается по одной.
      continue;
    }
  }
  return out;
}

// Вопросы живой сессии — то, что спрошено на самом деле: `Intent` дописывает раунды по ходу разговора,
// и жёсткий список на доске о них не знает.
function sessionQuestions(dir) {
  try {
    const st = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
    return (st.questions || []).map((q) => ({
      id: q.id,
      title: q.title || null,
      text: q.body || '',
      round: q.round || 1,
      status: q.status || 'open',
    }));
  } catch {
    return null; // нет state.json или он не разобрался — вопросов из этой сессии нет
  }
}

/** Вопросы со всех заходов по порядку; один вопрос, перенесённый в новый заход, остаётся одним. */
function questionsOf(dirs) {
  const seen = new Set();
  const questions = [];
  for (const d of dirs) {
    for (const q of sessionQuestions(d) || []) {
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      questions.push(q);
    }
  }
  return questions;
}

/** Живые сессии по номеру позиции: `{ url, alive, dir, questions }`. */
function sessionInfo(projectRoot) {
  const out = {};
  for (const { position, dirs } of positionSessions(projectRoot)) {
    if (!dirs.length) continue;
    const dir = dirs[dirs.length - 1]; // живой заход — последний
    out[position] = { ...serverOf(dir), dir, questions: questionsOf(dirs) };
  }
  return out;
}

module.exports = { readIdea, readLandingPrompt, readPictureText, readAnswers, sessionInfo };
