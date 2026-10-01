import { db, must } from './supabase';
import { HttpError } from './http';
import { computeTiming } from './exam';

export type Paper = {
  id: string; title: string; description: string | null; total_questions: number;
  section_count: number; questions_per_section: number; section_seconds: number;
  correct_marks: number; wrong_marks: number;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Attempt = Record<string, any>;

/** Loads an attempt ONLY if it belongs to this candidate (otherwise 404 - no information leak). */
export async function loadOwned(attemptId: string, candidateId: string) {
  const { data: a, error } = await db().from('attempts').select('*').eq('id', attemptId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!a || a.candidate_id !== candidateId) throw new HttpError(404, 'NOT_FOUND', 'Attempt not found.');
  const paper = must(await db().from('papers').select('*').eq('id', a.paper_id).single()) as Paper;
  return { attempt: a as Attempt, paper };
}

export async function finalize(attemptId: string, status: 'COMPLETED' | 'AUTO_SUBMITTED'): Promise<Attempt> {
  const { data, error } = await db().rpc('finalize_attempt', { p_attempt: attemptId, p_status: status });
  if (error) throw new Error(error.message);
  return data as Attempt;
}

/** If the total exam time is over, auto-submit now. Returns the up-to-date attempt. */
export async function syncAttempt(attempt: Attempt, paper: Paper): Promise<Attempt> {
  if (attempt.status !== 'IN_PROGRESS') return attempt;
  const t = computeTiming(Date.parse(attempt.started_at), Date.now(), paper);
  return t.finished ? finalize(attempt.id, 'AUTO_SUBMITTED') : attempt;
}

export type ResultRow = {
  id: string; image: boolean; imageWhole: boolean; number: number; section: number; text: string; options: string[];
  yourOption: number | null; correctOption: number; status: 'CORRECT' | 'WRONG' | 'UNANSWERED';
};

/** Only call for a FINISHED attempt - this contains the correct answers. */
export async function buildResultRows(attempt: Attempt, paper: Paper): Promise<ResultRow[]> {
  const qs = must(await db().from('questions')
    .select('id,question_number,section,question_text,option_a,option_b,option_c,option_d,correct_option,image_path,image_whole')
    .eq('paper_id', paper.id).order('question_number')) as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const ans = must(await db().from('answers').select('question_id,selected_option').eq('attempt_id', attempt.id)) as
    { question_id: string; selected_option: number | null }[];
  const map = new Map(ans.map((a) => [a.question_id, a.selected_option]));
  return qs.map((q) => {
    const sel = map.get(q.id) ?? null;
    return {
      id: q.id, image: !!q.image_path, imageWhole: !!q.image_path && q.image_whole !== false, number: q.question_number, section: q.section, text: q.question_text,
      options: [q.option_a, q.option_b, q.option_c, q.option_d],
      yourOption: sel, correctOption: q.correct_option,
      status: sel === null ? 'UNANSWERED' : sel === q.correct_option ? 'CORRECT' : 'WRONG',
    };
  });
}
