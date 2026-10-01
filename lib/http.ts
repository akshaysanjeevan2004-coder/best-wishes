import { NextResponse } from 'next/server';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string, public details?: string[]) {
    super(message || code);
  }
}

export const ok = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handle(fn: (req: Request, ctx: any) => Promise<Response>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: Request, ctx: any) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ error: e.code, message: e.message, details: e.details }, { status: e.status, headers: { 'Cache-Control': 'no-store' } });
      }
      console.error(e);
      return NextResponse.json({ error: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' }, { status: 500 });
    }
  };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuid(v: unknown, name = 'id'): string {
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw new HttpError(400, 'INVALID_INPUT', `Invalid ${name}`);
  return v;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    if (b && typeof b === 'object') return b as Record<string, unknown>;
  } catch { /* fallthrough */ }
  throw new HttpError(400, 'INVALID_JSON', 'Invalid JSON body');
}
