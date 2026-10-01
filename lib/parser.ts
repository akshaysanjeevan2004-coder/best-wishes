/**
 * Exam text parser: turns text extracted from a question-paper PDF into structured questions.
 * Option indexing: 0=A, 1=B, 2=C, 3=D.
 *
 * Handles:  "Q1." / "1." / "1)" / "Question 1:"  question starts
 *           "(a) .." / "a) .." / "A. .." / "[a] .." options (own lines or inline)
 *           "Ans.(b)" / "Ans: b" / "Answer - (B)" inline answers
 *           A trailing "Answer Key" table:  "1. (b)  2. (c)" / "1-b" / "1 b" / "1. 2"
 * It never silently invents data: every problem is reported per question.
 */
export type ParsedQ = {
  question_number: number;
  question_text: string;
  options: string[];
  correct_option: number | null;
};
export type ParseResult = { title: string; questions: ParsedQ[]; errors: string[]; warnings: string[] };

const LETTERS = 'ABCD';
const NOISE = /^\s*(?:page\s*\d+(?:\s*(?:of|\/)\s*\d+)?|-\s*\d+\s*-|\d+\s*\/\s*\d+)\s*$/i;
const ANS_RE = /ans(?:wer)?\s*(?:[.:\-\u2013]\s*[(\[]?|[(\[])\s*([a-dA-D1-4])\s*[)\]]?(?![A-Za-z])/gi;
const SOL_RE = /\n\s*(?:sol(?:ution)?|explanation|exp)\s*[.:\-]/i;

function ansToIndex(tok: string): number {
  return /\d/.test(tok) ? Number(tok) - 1 : LETTERS.indexOf(tok.toUpperCase());
}

function parseKey(keyText: string, expected: number): Map<number, number> {
  const out = new Map<number, number>();
  const re = /(?:Q\.?\s*)?(\d{1,3})\s*[.\-:)]*\s*[(\[]?\s*([a-dA-D1-4])\s*[)\]]?(?![A-Za-z0-9])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(keyText))) {
    const n = Number(m[1]);
    if (n >= 1 && n <= expected && !out.has(n)) out.set(n, ansToIndex(m[2]));
  }
  return out;
}

function findOptions(t: string): { qtext: string; opts: string[] } | null {
  const mk = (l: string) => new RegExp(`(?:^|\\s)[(\\[]?${l}[)\\]\\.]\\s*`, 'gi');
  const aMatches = [...t.matchAll(mk('a'))];
  // Prefer the LAST "a" marker whose b, c, d markers follow in order (avoids "a)" inside question text).
  for (let i = aMatches.length - 1; i >= 0; i--) {
    const am = aMatches[i];
    const pos = [{ idx: am.index!, len: am[0].length }];
    let from = am.index! + am[0].length, ok = true;
    for (const l of ['b', 'c', 'd']) {
      const r = mk(l); r.lastIndex = from;
      const m = r.exec(t);
      if (!m) { ok = false; break; }
      pos.push({ idx: m.index, len: m[0].length });
      from = m.index + m[0].length;
    }
    if (!ok) continue;
    const opts = pos.map((p, k) => t.slice(p.idx + p.len, k < 3 ? pos[k + 1].idx : t.length).replace(/\s+/g, ' ').trim());
    return { qtext: t.slice(0, pos[0].idx).trim(), opts };
  }
  return null;
}

function missingLetters(t: string): string[] {
  const miss: string[] = [];
  let from = 0;
  for (const l of 'abcd') {
    const r = new RegExp(`(?:^|\\s)[(\\[]?${l}[)\\]\\.]\\s*`, 'gi'); r.lastIndex = from;
    const m = r.exec(t);
    if (!m) miss.push(l.toUpperCase()); else from = m.index + m[0].length;
  }
  return miss;
}

export function parseExamText(raw: string, expected = 100): ParseResult {
  const errors: string[] = [], warnings: string[] = [];
  let text = raw.replace(/\r/g, '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ');

  // 1. Split off a trailing answer-key section, if any.
  let keyText = '';
  const hdr = [...text.matchAll(/^\s*(?:final\s+)?answer\s*key\b.*$/gim)];
  if (hdr.length) {
    const idx = hdr[hdr.length - 1].index!;
    keyText = text.slice(idx);
    text = text.slice(0, idx);
  }
  const key = parseKey(keyText, expected);

  // 2. Segment into question blocks using SEQUENTIAL numbering (guards against numbers inside text).
  const lines = text.split('\n').filter((l) => !NOISE.test(l));
  const startRe = (n: number) => new RegExp(`^\\s*(?:Q(?:uestion)?\\.?\\s*)?${n}\\s*[.):\\-]\\s*(.*)$`, 'i');
  const blocks = new Map<number, string[]>();
  const titleLines: string[] = [];
  let n = 1, cur: number | null = null;
  for (const line of lines) {
    let started = false;
    for (const k of [n, n + 1, n + 2]) {
      if (k > expected) break;
      if (k > n) {
        // Only accept a skip if the current block already looks complete (has an option D marker).
        const curText = cur ? blocks.get(cur)!.join('\n') : '';
        if (!cur || !findOptions(curText)) continue;
      }
      const m = line.match(startRe(k));
      if (m) {
        for (let s = n; s < k; s++) warnings.push(`Question ${s}: start marker not found - check the PDF around this question.`);
        cur = k; n = k + 1; blocks.set(k, [m[1]]); started = true; break;
      }
    }
    if (started) continue;
    if (cur) blocks.get(cur)!.push(line);
    else if (line.trim()) titleLines.push(line.trim());
  }

  // 3. Parse each block.
  const questions: ParsedQ[] = [];
  for (let q = 1; q <= expected; q++) {
    const blk = blocks.get(q);
    if (!blk) {
      errors.push(`Could not parse Question ${q}. Possible reason: the question number marker was not found.`);
      questions.push({ question_number: q, question_text: '', options: ['', '', '', ''], correct_option: key.get(q) ?? null });
      continue;
    }
    let t = blk.join('\n');
    let inline: number | null = null;
    const ms = [...t.matchAll(ANS_RE)];
    if (ms.length) {
      const m = ms[ms.length - 1];
      inline = ansToIndex(m[1]);
      t = t.slice(0, m.index);
    }
    const sol = t.search(SOL_RE);
    if (sol >= 0) t = t.slice(0, sol);

    const found = findOptions(t);
    let qtext = '', opts = ['', '', '', ''];
    if (!found) {
      const miss = missingLetters(t);
      errors.push(`Could not parse Question ${q}. Possible reason: option marker${miss.length > 1 ? 's' : ''} ${miss.join(', ')} missing.`);
      qtext = t.trim();
    } else {
      qtext = found.qtext.split('\n').map((s) => s.trim()).filter(Boolean).join('\n');
      opts = found.opts;
      opts.forEach((o, i) => { if (!o) errors.push(`Question ${q}: option ${LETTERS[i]} is empty.`); });
      if (!qtext) errors.push(`Question ${q}: question text is empty.`);
    }
    const correct = inline ?? key.get(q) ?? null;
    if (correct === null) errors.push(`Question ${q}: answer not found (no "Ans" line and not in the answer key).`);
    else if (inline !== null && key.has(q) && key.get(q) !== inline) warnings.push(`Question ${q}: inline answer (${LETTERS[inline]}) differs from the answer key (${LETTERS[key.get(q)!]}). Inline answer used - please verify.`);
    questions.push({ question_number: q, question_text: qtext, options: opts, correct_option: correct });
  }

  const found = blocks.size;
  if (found !== expected) errors.unshift(`Detected ${found} questions but expected ${expected}.`);
  const title = titleLines.find((l) => l.length <= 120) || '';
  return { title, questions, errors, warnings };
}
