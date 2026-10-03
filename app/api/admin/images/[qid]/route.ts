import { handle, uuid, HttpError } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase';
import { imageResponse } from '@/lib/images';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req, { params }) => {
  requireAdmin();
  const { data: q } = await db().from('questions').select('image_path,image_path_hi').eq('id', uuid(params.qid, 'question')).maybeSingle();
  const path = new URL(req.url).searchParams.get('lang') === 'hi' ? q?.image_path_hi : q?.image_path;
  if (!path) throw new HttpError(404, 'NOT_FOUND', 'Image not found.');
  return imageResponse(path);
});
