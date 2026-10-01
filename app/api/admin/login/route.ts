import { handle, ok, readJson, HttpError } from '@/lib/http';
import { checkAdminCredentials, setAdminCookie } from '@/lib/auth';
export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  const b = await readJson(req);
  const u = typeof b.username === 'string' ? b.username : '';
  const p = typeof b.password === 'string' ? b.password : '';
  if (!checkAdminCredentials(u, p)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down brute force
    throw new HttpError(401, 'BAD_LOGIN', 'Incorrect username or password.');
  }
  setAdminCookie();
  return ok({ ok: true });
});
