import { handle, ok, readJson, uuid, HttpError } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { normCorrect } from '@/lib/validate';

export const dynamic = 'force-dynamic';

const L = ['A', 'B', 'C', 'D'];

/**
 * Attach the Hindi text of a paper (from the Hindi PDF's paper.json), matched by question number.
 * SAFETY: the correct answer in the Hindi PDF must equal the English one for EVERY question, otherwise nothing is saved.
 * Text may be empty for a question that will be covered by a screenshot; completeness is checked before candidates can pick Hindi.
 */
export const POST = handle(async (req) => {
  requireAdmin();
  const b = await readJson(req);
  const paperId = uuid(b.paperId, 'paperId');
  const { count } = await db().from('attempts').select('id', { count: 'exact', head: true }).eq('paper_id', paperId);
  if (count) throw new HttpError(409, 'HAS_ATTEMPTS', `Candidates have already attempted this paper (${count}). It can no longer be changed.`);

  const en = must(await db().from('questions').select('question_number,correct_option').eq('paper_id', paperId)) as { question_number: number; correct_option: number }[];
  if (!en.length) throw new HttpError(404, 'NOT_FOUND', 'Paper not found.');
  const enAns = new Map(en.map((q) => [q.question_number, q.correct_option]));
  if (!Array.isArray(b.questions)) throw new HttpError(400, 'INVALID_INPUT', '"questions" must be a list.');

  const errors: string[] = [];
  const seen = new Set<number>();
  const clean: { question_number: number; question_text: string; options: string[] }[] = [];
  for (const q of b.questions as Record<string, unknown>[]) {
    const n = q?.question_number as number;
    if (!Number.isInteger(n) || !enAns.has(n)) { errors.push(`Unknown question number ${String(n)}.`); continue; }
    if (seen.has(n)) { errors.push(`Question ${n}: duplicate.`); continue; }
    seen.add(n);
    const c = normCorrect(q.correct_option);
    if (c === null) errors.push(`Question ${n}: answer missing in the Hindi file.`);
    else if (c !== enAns.get(n)) errors.push(`Question ${n}: Hindi file says ${L[c]} but the English paper says ${L[enAns.get(n)!]}. Fix before importing.`);
    const opts = Array.isArray(q.options) ? q.options.map((o) => (typeof o === 'string' ? o.slice(0, 2000) : '')) : [];
    while (opts.length < 4) opts.push('');
    clean.push({ question_number: n, question_text: typeof q.question_text === 'string' ? q.question_text.slice(0, 5000) : '', options: opts.slice(0, 4) });
  }
  for (const n of enAns.keys()) if (!seen.has(n)) errors.push(`Question ${n}: missing from the Hindi file.`);
  if (errors.length) throw new HttpError(422, 'VALIDATION_FAILED', 'Hindi import failed. Nothing was saved.', errors.slice(0, 30));

  const { data, error } = await db().rpc('apply_hindi', { p_paper: paperId, p: clean });
  if (error) throw new Error(error.message);
  return ok({ ok: true, updated: data });
});
