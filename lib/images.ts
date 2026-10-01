import { db } from './supabase';
import { HttpError } from './http';

export const IMAGE_BUCKET = 'question-images';

/** Streams a private Storage image. Callers MUST do their own authorisation first. */
export async function imageResponse(path: string): Promise<Response> {
  const { data, error } = await db().storage.from(IMAGE_BUCKET).download(path);
  if (error || !data) throw new HttpError(404, 'NO_IMAGE', 'Image not found.');
  const ext = path.split('.').pop()?.toLowerCase();
  const type = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
  return new Response(await data.arrayBuffer(), {
    headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
  });
}
