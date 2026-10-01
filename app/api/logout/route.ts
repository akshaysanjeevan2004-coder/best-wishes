import { handle, ok } from '@/lib/http';
import { clearCandidateCookie } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export const POST = handle(async () => { clearCandidateCookie(); return ok({ ok: true }); });
