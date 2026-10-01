import { db, must } from '@/lib/supabase';
import { todayStr, fmtDate } from '@/lib/config';
import SchedulePanel from '@/components/admin/SchedulePanel';
import RemoveScheduleButton from '@/components/admin/RemoveScheduleButton';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const papers = must(await db().from('papers').select('id,title').order('created_at', { ascending: false })) as { id: string; title: string }[];
  const rows = must(await db().from('daily_papers').select('id,exam_date,slot,papers(title)').gte('exam_date', todayStr()).order('exam_date').order('slot')) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl font-bold text-brand-900">Daily schedule</h1>
      <SchedulePanel papers={papers} today={todayStr()} />
      <section>
        <h2 className="font-serif text-xl font-bold">Upcoming (today onwards)</h2>
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead className="border-b bg-slate-50"><tr><th className="th">Date</th><th className="th">Slot</th><th className="th">Paper</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}><td className="td">{fmtDate(r.exam_date)}{r.exam_date === todayStr() && <span className="ml-2 rounded bg-saffron-100 px-1.5 text-xs">today</span>}</td>
                  <td className="td">{r.slot}</td><td className="td font-medium">{r.papers?.title}</td>
                  <td className="td text-right"><RemoveScheduleButton id={r.id} /></td></tr>
              ))}
              {rows.length === 0 && <tr><td className="td text-slate-500" colSpan={4}>Nothing scheduled.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
