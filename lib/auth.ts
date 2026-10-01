import crypto from 'crypto';
import { cookies } from 'next/headers';
import { HttpError } from './http';
import { db } from './supabase';

const CAND_COOKIE = 'bw_candidate';
const ADMIN_COOKIE = 'bw_admin';

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('ADMIN_SESSION_SECRET must be set (16+ chars)');
  return s;
}
const b64 = (s: string) => Buffer.from(s).toString('base64url');
const mac = (data: string) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

export function sign(payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  return `${body}.${mac(body)}`;
}

export function verify(token: string | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = mac(body);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof p.exp !== 'number' || p.exp < Date.now() / 1000) return null;
    return p;
  } catch { return null; }
}

const cookieOpts = (maxAge: number) => ({
  httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge,
});

/* ---------------- candidates ---------------- */
export type Candidate = { id: string; name: string; mobile: string; email: string };

export function setCandidateCookie(id: string) {
  const ttl = 60 * 60 * 24 * 30;
  cookies().set(CAND_COOKIE, sign({ role: 'candidate', cid: id }, ttl), cookieOpts(ttl));
}
export function clearCandidateCookie() { cookies().delete(CAND_COOKIE); }

export async function getCandidate(): Promise<Candidate | null> {
  const p = verify(cookies().get(CAND_COOKIE)?.value);
  if (!p || p.role !== 'candidate' || typeof p.cid !== 'string') return null;
  const { data } = await db().from('candidates').select('id,name,mobile,email').eq('id', p.cid).maybeSingle();
  return (data as Candidate) ?? null;
}
export async function requireCandidate(): Promise<Candidate> {
  const c = await getCandidate();
  if (!c) throw new HttpError(401, 'NOT_REGISTERED', 'Please enter your details on the home page first.');
  return c;
}

/* ---------------- admin ---------------- */
export function setAdminCookie() {
  const ttl = 60 * 60 * 8;
  cookies().set(ADMIN_COOKIE, sign({ role: 'admin' }, ttl), cookieOpts(ttl));
}
export function clearAdminCookie() { cookies().delete(ADMIN_COOKIE); }
export function isAdmin(): boolean {
  const p = verify(cookies().get(ADMIN_COOKIE)?.value);
  return !!p && p.role === 'admin';
}
export function requireAdmin() {
  if (!isAdmin()) throw new HttpError(401, 'UNAUTHORIZED', 'Admin login required');
}

export function checkAdminCredentials(username: string, password: string): boolean {
  const expectedPass = process.env.ADMIN_PASSWORD;
  const expectedUser = process.env.ADMIN_USERNAME || 'admin';
  if (!expectedPass) return false;
  const eq = (x: string, y: string) => {
    const hx = crypto.createHash('sha256').update(x).digest();
    const hy = crypto.createHash('sha256').update(y).digest();
    return crypto.timingSafeEqual(hx, hy);
  };
  const u = eq(username.trim().toLowerCase(), expectedUser.trim().toLowerCase());
  const p = eq(password, expectedPass);
  return u && p;
}
