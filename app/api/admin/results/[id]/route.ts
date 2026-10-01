import { handle, ok, uuid, HttpError } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase';
import { syncAttempt, buildResultRows, type Paper } from '@/lib/attempts';

export const dynamic = 'force-dynamic';

export const GET = handle(async (_req, { params }) => {
  requireAdmin();
  const id = uuid(params.id);
  const { data: a } = await db().from('attempts').select('*').eq('id', id).maybeSingle();
  if (!a) throw new HttpError(404, 'NOT_FOUND', 'Attempt not found.');
  const { data: paper } = await db().from('papers').select('*').eq('id', a.paper_id).single();
  const fresh = await syncAttempt(a, paper as Paper);
  return ok({ attempt: fresh, rows: await buildResultRows(fresh, paper as Paper) });
});
