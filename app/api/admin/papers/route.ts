import { handle, ok, readJson, uuid, HttpError } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { validatePaperInput } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  requireAdmin();
  return ok({ papers: must(await db().from('papers').select('*').order('created_at', { ascending: false })) });
});

/** Validate (server-side, authoritative) then insert paper + questions in ONE transaction. */
export const POST = handle(async (req) => {
  requireAdmin();
  const { errors, clean } = validatePaperInput(await readJson(req));
  if (!clean) throw new HttpError(422, 'VALIDATION_FAILED', 'Import failed.', errors);
  const { data, error } = await db().rpc('import_paper', { p: clean });
  if (error) throw new Error(error.message);
  return ok({ id: data, questions: clean.questions.length, sections: clean.section_count }, 201);
});

export const DELETE = handle(async (req) => {
  requireAdmin();
  const id = uuid(new URL(req.url).searchParams.get('id'), 'id');
  const { count } = await db().from('attempts').select('id', { count: 'exact', head: true }).eq('paper_id', id);
  if (count) throw new HttpError(409, 'HAS_ATTEMPTS', `This paper has ${count} candidate attempt(s) and cannot be deleted.`);
  const { error } = await db().from('papers').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return ok({ ok: true });
});
