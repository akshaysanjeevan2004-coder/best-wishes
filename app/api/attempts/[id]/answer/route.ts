import { handle, ok, readJson, uuid, HttpError } from '@/lib/http';
import { requireCandidate } from '@/lib/auth';
import { db } from '@/lib/supabase';
import { loadOwned, finalize } from '@/lib/attempts';
import { computeTiming } from '@/lib/exam';

export const dynamic = 'force-dynamic';

/**
 * Save / change / clear an answer.
 * Checks: attempt exists & is yours -> still IN_PROGRESS -> exam time not over ->
 * question belongs to THIS paper -> question is in the section open RIGHT NOW (server clock).
 * The database trigger `answers_guard` re-checks all of this as a final backstop.
 */
export const POST = handle(async (req, { params }) => {
  const cand = await requireCandidate();
  const { attempt, paper } = await loadOwned(uuid(params.id), cand.id);
  const b = await readJson(req);
  const questionId = uuid(b.questionId, 'questionId');
  const sel = b.selectedOption;
  if (sel !== null && !(typeof sel === 'number' && Number.isInteger(sel) && sel >= 0 && sel <= 3))
    throw new HttpError(400, 'INVALID_OPTION', 'Invalid option.');

  if (attempt.status !== 'IN_PROGRESS') throw new HttpError(403, 'ATTEMPT_CLOSED', 'This exam has already been submitted.');
  const t = computeTiming(Date.parse(attempt.started_at), Date.now(), paper);
  if (t.finished) {
    await finalize(attempt.id, 'AUTO_SUBMITTED');
    throw new HttpError(403, 'EXAM_EXPIRED', 'Time is over. The exam has been submitted.');
  }

  const { data: q } = await db().from('questions').select('id,paper_id,section').eq('id', questionId).maybeSingle();
  if (!q || q.paper_id !== attempt.paper_id) throw new HttpError(400, 'INVALID_QUESTION', 'This question is not part of your exam.');
  if (q.section !== t.section) throw new HttpError(403, 'SECTION_LOCKED', 'This section is locked. Answers can no longer be changed.');

  const { error } = await db().from('answers')
    .upsert({ attempt_id: attempt.id, question_id: questionId, selected_option: sel, answered_at: new Date().toISOString() },
      { onConflict: 'attempt_id,question_id' });
  if (error) {
    if (/SECTION_LOCKED|EXAM_EXPIRED|ATTEMPT_CLOSED|WRONG_PAPER/.test(error.message))
      throw new HttpError(403, 'SECTION_LOCKED', 'This section is locked. Answers can no longer be changed.');
    throw new Error(error.message);
  }
  return ok({ ok: true, questionId, selectedOption: sel });
});
