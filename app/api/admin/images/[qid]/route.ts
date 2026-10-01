import { handle, uuid, HttpError } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase';
import { imageResponse } from '@/lib/images';

export const dynamic = 'force-dynamic';

export const GET = handle(async (_req, { params }) => {
  requireAdmin();
  const { data: q } = await db().from('questions').select('image_path').eq('id', uuid(params.qid, 'question')).maybeSingle();
  if (!q?.image_path) throw new HttpError(404, 'NOT_FOUND', 'Image not found.');
  return imageResponse(q.image_path);
});
