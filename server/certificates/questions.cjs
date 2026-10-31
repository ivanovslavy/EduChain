// EduChain certificates — the question bank, and the one rule that makes the exam honest:
// THE CORRECT ANSWER NEVER LEAVES THIS PROCESS.
//
// The banks live next to this file, server-side, and are loaded once at startup. Everything handed
// to a browser goes through `publicQuestion()`, which builds a new object containing the text and
// the options in the order this attempt will see them — and nothing else. There is no code path that
// serialises `correct` or `why` towards a client, and the test suite asserts exactly that by
// scanning every API response for the correct keys.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIR = path.join(__dirname, "questions");
const LANGS = ["bg", "en", "es"];
const OPTION_KEYS = ["a", "b", "c", "d"];

// How an exam is put together.
const EXAM_SIZE = parseInt(process.env.CERT_EXAM_SIZE || "20", 10);
const PASS_PCT = parseInt(process.env.CERT_PASS_PCT || "80", 10);
// A spread across topics and difficulty, so twenty random questions cannot all be easy ones about
// wallets. Shortfalls are filled from whatever is left, so the bank can grow unevenly.
const BY_LEVEL = { 1: 7, 2: 8, 3: 5 };

let banks = null;

function load() {
  if (banks) return banks;
  banks = {};
  for (const lang of LANGS) {
    const p = path.join(DIR, `questions.${lang}.json`);
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    const list = raw.questions;
    const byId = new Map();
    for (const q of list) {
      if (!q.id || !q.q || !q.options || !q.correct) throw new Error(`${p}: malformed question ${q.id}`);
      if (!OPTION_KEYS.every((k) => typeof q.options[k] === "string" && q.options[k].length)) {
        throw new Error(`${p}: question ${q.id} does not have four options`);
      }
      if (!OPTION_KEYS.includes(q.correct)) throw new Error(`${p}: question ${q.id} has no valid correct key`);
      byId.set(q.id, q);
    }
    banks[lang] = { list, byId };
  }
  // The three banks must be the same exam in three languages: same ids, same correct answers.
  const ref = banks.bg;
  for (const lang of LANGS) {
    if (lang === "bg") continue;
    const b = banks[lang];
    if (b.list.length !== ref.list.length) throw new Error(`bank ${lang} has ${b.list.length} questions, bg has ${ref.list.length}`);
    for (const q of ref.list) {
      const o = b.byId.get(q.id);
      if (!o) throw new Error(`bank ${lang} is missing question ${q.id}`);
      if (o.correct !== q.correct) throw new Error(`bank ${lang}: question ${q.id} has a different correct answer than bg`);
      if (o.topic !== q.topic || o.level !== q.level) throw new Error(`bank ${lang}: question ${q.id} has a different topic/level than bg`);
    }
  }
  return banks;
}

/** Cryptographically-seeded Fisher-Yates. Math.random has no place in deciding an exam. */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Compose one exam: which questions, in which order, with the options permuted per question.
 * Returns the server-side shape that is stored on the attempt:
 *   [{ id, order: ["c","a","d","b"] }]
 * `order[i]` is the ORIGINAL option key shown in position i. The browser only ever sees positions.
 */
function composeExam() {
  const bank = load().bg.list; // ids/levels are identical across languages
  const picked = [];
  const used = new Set();
  for (const [level, want] of Object.entries(BY_LEVEL)) {
    const pool = shuffle(bank.filter((q) => String(q.level) === level && !used.has(q.id)));
    for (const q of pool.slice(0, want)) { picked.push(q); used.add(q.id); }
  }
  // Fill any shortfall (a level with too few questions) from the rest of the bank.
  if (picked.length < EXAM_SIZE) {
    for (const q of shuffle(bank.filter((q) => !used.has(q.id)))) {
      if (picked.length >= EXAM_SIZE) break;
      picked.push(q); used.add(q.id);
    }
  }
  return shuffle(picked.slice(0, EXAM_SIZE)).map((q) => ({ id: q.id, order: shuffle(OPTION_KEYS) }));
}

/**
 * The question as the browser may see it. Positions are 1..4 and carry no hint of the original key.
 * There is no `correct` here and there is no way to add one by accident: the object is built from
 * scratch, not filtered from the source.
 */
function publicQuestion(spec, lang, index, total) {
  const b = load()[LANGS.includes(lang) ? lang : "en"];
  const q = b.byId.get(spec.id);
  if (!q) throw new Error(`unknown question ${spec.id}`);
  return {
    index,
    total,
    topic: q.topic,
    level: q.level,
    text: q.q,
    options: spec.order.map((origKey, i) => ({ pos: i + 1, text: q.options[origKey] })),
  };
}

/** Is the answer at `pos` (1..4) the correct one for this question? Server-side only. */
function isCorrect(spec, pos) {
  const q = load().bg.byId.get(spec.id);
  if (!q) throw new Error(`unknown question ${spec.id}`);
  const chosenOriginalKey = spec.order[Number(pos) - 1];
  return chosenOriginalKey === q.correct;
}

function examSize() { return EXAM_SIZE; }
function passPct() { return PASS_PCT; }
function bankSize() { return load().bg.list.length; }

module.exports = { load, composeExam, publicQuestion, isCorrect, examSize, passPct, bankSize, shuffle, LANGS };
