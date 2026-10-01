import { handle, ok, uuid } from '@/lib/http';
import { requireCandidate } from '@/lib/auth';
import { loadOwned, finalize } from '@/lib/attempts';
import { computeTiming } from '@/lib/exam';

export const dynamic = 'force-dynamic';

/** Idempotent: calling it again just returns the stored result. Scoring happens inside ONE DB transaction. */
export const POST = handle(async (_req, { params }) => {
  const cand = await requireCandidate();
  const { attempt, paper } = await loadOwned(uuid(params.id), cand.id);
  if (attempt.status !== 'IN_PROGRESS') return ok({ status: attempt.status, resultUrl: `/result/${attempt.id}` });
  const t = computeTiming(Date.parse(attempt.started_at), Date.now(), paper);
  const done = await finalize(attempt.id, t.finished ? 'AUTO_SUBMITTED' : 'COMPLETED');
  return ok({ status: done.status, resultUrl: `/result/${done.id}` });
});
