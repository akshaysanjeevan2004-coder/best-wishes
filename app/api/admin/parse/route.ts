import { handle, ok, HttpError } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { parseExamText } from '@/lib/parser';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

/** Upload a PDF (or .txt) -> structured draft + validation report. Nothing is saved yet. */
export const POST = handle(async (req) => {
  requireAdmin();
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') throw new HttpError(400, 'NO_FILE', 'Please choose a PDF file.');
  if (file.size > 4 * 1024 * 1024) throw new HttpError(413, 'TOO_LARGE', 'File is larger than 4 MB. Use scripts/import_pdf.py locally for big files.');
  const name = file.name || 'paper';
  let text = '';
  if (/\.pdf$/i.test(name)) {
    const pdf = (await import('pdf-parse/lib/pdf-parse.js')).default;
    try { text = (await pdf(Buffer.from(await file.arrayBuffer()))).text; }
    catch { throw new HttpError(422, 'PDF_UNREADABLE', 'Could not read this PDF.'); }
  } else if (/\.txt$/i.test(name)) {
    text = await file.text();
  } else throw new HttpError(400, 'BAD_TYPE', 'Upload a .pdf or .txt file.');
  if (text.trim().length < 50)
    throw new HttpError(422, 'NO_TEXT', 'No text found. This looks like a scanned/image PDF - run OCR first (see README).');
  const expected = Number(form?.get('expected')) || 100;
  const result = parseExamText(text, Math.min(Math.max(expected, 1), 300));
  return ok({ ...result, source_filename: name });
});
