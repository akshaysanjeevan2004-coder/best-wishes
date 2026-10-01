import { handle, ok, uuid } from '@/lib/http';
import { requireCandidate } from '@/lib/auth';
import { getActivity } from '@/lib/queries';
export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  await requireCandidate();
  const raw = new URL(req.url).searchParams.get('paper');
  const paperId = raw ? uuid(raw, 'paper') : undefined;
  return ok({ rows: await getActivity({ paperId, order: paperId ? 'score' : 'recent', limit: 100 }) });
});
