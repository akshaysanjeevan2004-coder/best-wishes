import crypto from 'crypto';
import { handle, ok, uuid, HttpError } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase';
import { IMAGE_BUCKET } from '@/lib/images';

export const dynamic = 'force-dynamic';

function sniff(buf: Buffer): { ext: string; type: string } | null {
  if (buf.length > 8 && buf.subarray(0, 4).toString('hex') === '89504e47') return { ext: 'png', type: 'image/png' };
  if (buf.length > 3 && buf.subarray(0, 3).toString('hex') === 'ffd8ff') return { ext: 'jpg', type: 'image/jpeg' };
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  return null;
}

async function target(paperId: string, qn: number) {
  const { count } = await db().from('attempts').select('id', { count: 'exact', head: true }).eq('paper_id', paperId);
  if (count) throw new HttpError(409, 'HAS_ATTEMPTS', `Candidates have already attempted this paper (${count}). Its questions can no longer be changed.`);
  const { data: q } = await db().from('questions').select('id,image_path').eq('paper_id', paperId).eq('question_number', qn).maybeSingle();
  if (!q) throw new HttpError(404, 'NOT_FOUND', `Question ${qn} not found in this paper.`);
  return q as { id: string; image_path: string | null };
}

/** Attach / replace the screenshot of ONE question (multipart: paperId, questionNumber, whole, file). */
export const POST = handle(async (req) => {
  requireAdmin();
  const form = await req.formData().catch(() => null);
  if (!form) throw new HttpError(400, 'BAD_FORM', 'Invalid upload.');
  const paperId = uuid(form.get('paperId'), 'paperId');
  const qn = Number(form.get('questionNumber'));
  if (!Number.isInteger(qn) || qn < 1 || qn > 500) throw new HttpError(400, 'INVALID_INPUT', 'Invalid question number.');
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new HttpError(400, 'NO_FILE', 'Choose an image.');
  if (file.size > 4 * 1024 * 1024) throw new HttpError(413, 'TOO_LARGE', 'Image is larger than 4 MB.');
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind) throw new HttpError(400, 'BAD_TYPE', 'Only PNG, JPG or WEBP images are allowed.');
  const whole = form.get('whole') !== 'false';

  const q = await target(paperId, qn);
  const path = `${paperId}/q${String(qn).padStart(3, '0')}-${crypto.randomBytes(4).toString('hex')}.${kind.ext}`;
  const up = await db().storage.from(IMAGE_BUCKET).upload(path, buf, { contentType: kind.type, upsert: false });
  if (up.error) throw new Error(up.error.message);
  const { error } = await db().from('questions').update({ image_path: path, image_whole: whole }).eq('id', q.id);
  if (error) { await db().storage.from(IMAGE_BUCKET).remove([path]); throw new Error(error.message); }
  if (q.image_path) await db().storage.from(IMAGE_BUCKET).remove([q.image_path]);
  return ok({ ok: true, questionNumber: qn, whole });
});

/** Change only the "whole question / supplements text" setting, or remove the image. */
export const PATCH = handle(async (req) => {
  requireAdmin();
  const form = await req.json().catch(() => ({}));
  const paperId = uuid(form.paperId, 'paperId'); const qn = Number(form.questionNumber);
  const q = await target(paperId, qn);
  const { error } = await db().from('questions').update({ image_whole: form.whole !== false }).eq('id', q.id);
  if (error) throw new Error(error.message);
  return ok({ ok: true });
});

export const DELETE = handle(async (req) => {
  requireAdmin();
  const sp = new URL(req.url).searchParams;
  const paperId = uuid(sp.get('paper'), 'paper'); const qn = Number(sp.get('q'));
  const q = await target(paperId, qn);
  const { error } = await db().from('questions').update({ image_path: null, image_whole: true }).eq('id', q.id);
  if (error) throw new Error(error.message);
  if (q.image_path) await db().storage.from(IMAGE_BUCKET).remove([q.image_path]);
  return ok({ ok: true });
});
