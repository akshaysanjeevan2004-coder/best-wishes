import { handle, uuid, HttpError } from '@/lib/http';
import { requireCandidate } from '@/lib/auth';
import { db } from '@/lib/supabase';
import { loadOwned, finalize } from '@/lib/attempts';
import { computeTiming } from '@/lib/exam';
import { imageResponse } from '@/lib/images';
import { asLang, view, HI_FIELDS } from '@/lib/lang';

export const dynamic = 'force-dynamic';

/**
 * Question image. The bucket is private; this route is the ONLY way to get a picture, and it applies the same
 * timer rules as the JSON API: while the exam runs, only questions of the section open right now are served
 * (so future sections cannot be peeked at). After submission the candidate may open them again (result page).
 */
export const GET = handle(async (_req, { params }) => {
  const cand = await requireCandidate();
  const { attempt, paper } = await loadOwned(uuid(params.id), cand.id);
  const qid = uuid(params.qid, 'question');
  const { data: q } = await db().from('questions').select('paper_id,section,image_path,image_whole,' + HI_FIELDS).eq('id', qid).maybeSingle();
  const imagePath = q ? view(q, asLang(attempt.lang)).imagePath : null;
  if (!q || q.paper_id !== attempt.paper_id || !imagePath) throw new HttpError(404, 'NOT_FOUND', 'Image not found.');

  if (attempt.status === 'IN_PROGRESS') {
    const t = computeTiming(Date.parse(attempt.started_at), Date.now(), paper);
    if (t.finished) await finalize(attempt.id, 'AUTO_SUBMITTED');
    else if (q.section !== t.section) throw new HttpError(403, 'SECTION_LOCKED', 'This section is not open.');
  }
  return imageResponse(imagePath);
});
