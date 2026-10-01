import { handle, ok } from '@/lib/http';
import { clearAdminCookie } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export const POST = handle(async () => { clearAdminCookie(); return ok({ ok: true }); });
