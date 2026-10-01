import { handle, ok, uuid } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { queryAttempts, type ResultFilters } from '@/lib/queries';
import { fmtDateTime } from '@/lib/config';

export const dynamic = 'force-dynamic';

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export const GET = handle(async (req) => {
  requireAdmin();
  const sp = new URL(req.url).searchParams;
  const f: ResultFilters = {
    date: /^\d{4}-\d{2}-\d{2}$/.test(sp.get('date') ?? '') ? sp.get('date')! : undefined,
    paperId: sp.get('paper') ? uuid(sp.get('paper'), 'paper') : undefined,
    q: sp.get('q') || undefined,
    minScore: sp.get('min') ? Number(sp.get('min')) : undefined,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await queryAttempts(f, 5000);
  if (sp.get('format') === 'csv') {
    const head = ['Candidate', 'Mobile', 'Email', 'Paper', 'Exam date', 'Started', 'Submitted', 'Score', 'Correct', 'Wrong', 'Unanswered', 'Status'];
    const lines = [head.map(csvCell).join(',')].concat(rows.map((r) => [
      r.candidate_name, r.candidate_mobile, r.candidate_email, r.papers?.title, r.exam_date,
      fmtDateTime(r.started_at), fmtDateTime(r.submitted_at), r.score, r.correct_count, r.wrong_count, r.unanswered_count, r.status,
    ].map(csvCell).join(',')));
    return new Response('\uFEFF' + lines.join('\r\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="best-wishes-results.csv"', 'Cache-Control': 'no-store' },
    });
  }
  return ok({ rows });
});
