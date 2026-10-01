import { handle, ok, readJson, uuid, HttpError } from '@/lib/http';
import { requireCandidate } from '@/lib/auth';
import { db } from '@/lib/supabase';
import { getPaper, isScheduledToday } from '@/lib/queries';
import { todayStr } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** Start (or resume) the ONE attempt a candidate gets for a paper. Refreshing never creates another. */
export const POST = handle(async (req) => {
  const cand = await requireCandidate();
  const paperId = uuid((await readJson(req)).paperId, 'paperId');
  const paper = await getPaper(paperId);
  if (!paper) throw new HttpError(404, 'NOT_FOUND', 'Paper not found.');

  const existing = async () => (await db().from('attempts').select('id,status')
    .eq('candidate_id', cand.id).eq('paper_id', paperId).maybeSingle()).data as { id: string; status: string } | null;

  const found = await existing();
  if (found) return ok({ attemptId: found.id, status: found.status, existing: true });

  if (!(await isScheduledToday(paperId))) throw new HttpError(403, 'NOT_AVAILABLE', 'This test is not available today.');

  const { data, error } = await db().from('attempts').insert({
    paper_id: paperId, candidate_id: cand.id, candidate_name: cand.name,
    candidate_mobile: cand.mobile, candidate_email: cand.email, exam_date: todayStr(),
  }).select('id,status').single(); // started_at = DB clock (server time)
  if (error) {
    const again = await existing(); // double-click / race: unique(candidate, paper)
    if (again) return ok({ attemptId: again.id, status: again.status, existing: true });
    throw new Error(error.message);
  }
  return ok({ attemptId: data.id, status: data.status, existing: false }, 201);
});
