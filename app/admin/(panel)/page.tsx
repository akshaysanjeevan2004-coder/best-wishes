import Link from 'next/link';
import { db } from '@/lib/supabase';
import { todayStr, fmtDate, fmtDateTime } from '@/lib/config';
import { queryAttempts } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  await db().rpc('finalize_expired');
  const today = todayStr();
  const [papers, todayCount, attempts, done, scores, todays, recent] = await Promise.all([
    db().from('papers').select('id', { count: 'exact', head: true }),
    db().from('daily_papers').select('id', { count: 'exact', head: true }).eq('exam_date', today),
    db().from('attempts').select('id', { count: 'exact', head: true }),
    db().from('attempts').select('id', { count: 'exact', head: true }).neq('status', 'IN_PROGRESS'),
    db().from('attempts').select('score').neq('status', 'IN_PROGRESS').not('score', 'is', null).limit(5000),
    db().from('daily_papers').select('slot,papers(title)').eq('exam_date', today).order('slot'),
    queryAttempts({}, 8),
  ]);
  const sc = (scores.data ?? []).map((r) => Number(r.score));
  const avg = sc.length ? (sc.reduce((a, b) => a + b, 0) / sc.length).toFixed(1) : '-';
  const stats: [string, string | number][] = [
    ['Total papers', papers.count ?? 0], ["Today's papers", todayCount.count ?? 0],
    ['Total attempts', attempts.count ?? 0], ['Completed exams', done.count ?? 0], ['Average score', avg],
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todayRows = (todays.data ?? []) as any[];
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl font-bold text-brand-900">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map(([k, v]) => (
          <div key={k} className="card p-4"><p className="text-xs text-slate-500">{k}</p><p className="mt-1 font-serif text-3xl font-bold">{v}</p></div>
        ))}
      </div>
      <section className="card p-5">
        <h2 className="font-serif text-lg font-bold">Scheduled for today ({fmtDate(today)})</h2>
        {todayRows.length === 0 ? <p className="mt-2 text-slate-600">Nothing scheduled. <Link className="font-medium text-brand-700 underline" href="/admin/schedule">Schedule a paper</Link>.</p> : (
          <ul className="mt-2 space-y-1">{todayRows.map((r, i) => <li key={i}>Slot {r.slot}: <b>{r.papers?.title}</b></li>)}</ul>
        )}
      </section>
      <section>
        <div className="mb-3 flex items-end justify-between"><h2 className="font-serif text-lg font-bold">Recent attempts</h2><Link href="/admin/results" className="text-sm font-medium text-brand-700 hover:underline">All results</Link></div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px]"><tbody className="divide-y divide-slate-100">
            {recent.map((r) => (
              <tr key={r.id}><td className="td font-medium"><Link className="hover:underline" href={`/admin/results/${r.id}`}>{r.candidate_name}</Link></td>
                <td className="td text-slate-600">{r.papers?.title}</td><td className="td">{r.score ?? '-'}</td>
                <td className="td text-xs text-slate-500">{r.status}</td><td className="td text-xs text-slate-500">{fmtDateTime(r.started_at)}</td></tr>
            ))}
            {recent.length === 0 && <tr><td className="td text-slate-500">No attempts yet.</td></tr>}
          </tbody></table>
        </div>
      </section>
    </div>
  );
}
