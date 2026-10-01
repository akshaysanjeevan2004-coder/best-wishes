import { handle, ok, readJson, HttpError } from '@/lib/http';
import { db, must } from '@/lib/supabase';
import { setCandidateCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  const b = await readJson(req);
  const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : '';
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const digits = typeof b.mobile === 'string' ? b.mobile.replace(/\D/g, '') : '';
  const mobile = digits.length > 10 ? digits.slice(-10) : digits; // strips +91 / 0 prefix
  if (name.length < 2 || name.length > 80) throw new HttpError(400, 'INVALID_NAME', 'Please enter your full name.');
  if (!/^[6-9]\d{9}$/.test(mobile)) throw new HttpError(400, 'INVALID_MOBILE', 'Please enter a valid 10-digit mobile number.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) throw new HttpError(400, 'INVALID_EMAIL', 'Please enter a valid email address.');
  const row = must(await db().from('candidates')
    .upsert({ name, mobile, email }, { onConflict: 'mobile' }).select('id').single()) as { id: string };
  setCandidateCookie(row.id);
  return ok({ ok: true });
});
