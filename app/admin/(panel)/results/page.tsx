import Link from 'next/link';
import { queryAttempts, listPapersWithAttempts } from '@/lib/queries';
import { fmtDateTime } from '@/lib/config';
import { UUID_RE } from '@/lib/http';

export const dynamic = 'force-dynamic';
type SP = { date?: string; paper?: string; q?: string; min?: string };

export default async function ResultsPage({ searchParams }: { searchParams: SP }) {
  const f = {
    date: /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date ?? '') ? searchParams.date : undefined,
    paperId: searchParams.paper && UUID_RE.test(searchParams.paper) ? searchParams.paper : undefined,
    q: searchParams.q?.trim() || undefined,
    minScore: searchParams.min ? Number(searchParams.min) : undefined,
  };
  const [rows, papers] = await Promise.all([queryAttempts(f, 500), listPapersWithAttempts()]);
  const csv = new URLSearchParams(Object.entries({ date: f.date, paper: f.paperId, q: f.q, min: searchParams.min, format: 'csv' }).filter(([, v]) => v) as [string, string][]);
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-bold text-brand-900">Candidate results</h1>
      <form className="card grid gap-3 p-4 md:grid-cols-5" method="get">
        <input type="date" name="date" defaultValue={f.date} className="input" aria-label="Date" />
        <select name="paper" defaultValue={f.paperId ?? ''} className="input" aria-label="Paper"><option value="">All papers</option>{papers.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
        <input name="q" defaultValue={f.q} placeholder="Name, mobile or email" className="input" />
        <input name="min" type="number" step="0.5" defaultValue={searchParams.min} placeholder="Min score" className="input" />
        <div className="flex gap-2"><button className="btn btn-primary flex-1">Filter</button><Link href="/admin/results" className="btn btn-ghost">Reset</Link></div>
      </form>
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{rows.length} attempt(s){rows.length === 500 ? ' (showing the latest 500)' : ''}</span>
        <a className="font-medium text-brand-700 hover:underline" href={`/api/admin/results?${csv.toString()}`}>Download CSV</a>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead className="border-b bg-slate-50"><tr>{['Candidate', 'Mobile', 'Email', 'Paper', 'Started', 'Submitted', 'Score', 'Correct', 'Wrong', 'Unanswered', 'Status'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="td font-medium"><Link className="text-brand-700 hover:underline" href={`/admin/results/${r.id}`}>{r.candidate_name}</Link></td>
                <td className="td">{r.candidate_mobile}</td><td className="td">{r.candidate_email}</td><td className="td">{r.papers?.title}</td>
                <td className="td whitespace-nowrap text-xs">{fmtDateTime(r.started_at)}</td><td className="td whitespace-nowrap text-xs">{fmtDateTime(r.submitted_at)}</td>
                <td className="td font-semibold">{r.score ?? '-'}</td><td className="td">{r.correct_count ?? '-'}</td><td className="td">{r.wrong_count ?? '-'}</td><td className="td">{r.unanswered_count ?? '-'}</td>
                <td className="td text-xs">{r.status}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-slate-500" colSpan={11}>No attempts match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
