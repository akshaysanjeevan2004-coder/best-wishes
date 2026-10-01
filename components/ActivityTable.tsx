import { fmtDateTime } from '@/lib/config';
import type { ActivityRow } from '@/lib/queries';

export default function ActivityTable({ rows, ranked = false, sectionCount = 4 }: { rows: ActivityRow[]; ranked?: boolean; sectionCount?: number }) {
  if (!rows.length) return <p className="card p-6 text-center text-slate-500">No one has finished a test yet. Be the first.</p>;
  const secs = Array.from({ length: sectionCount }, (_, i) => i + 1);
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {ranked && <th className="th">Rank</th>}
            <th className="th">Candidate</th>
            <th className="th">Test</th>
            <th className="th">Score</th>
            <th className="th">Right</th>
            <th className="th">Wrong</th>
            <th className="th">Skipped</th>
            {secs.map((s) => <th key={s} className="th">Wrong in S{s}</th>)}
            <th className="th">Finished</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={r.id}>
              {ranked && <td className="td font-semibold">{i + 1}</td>}
              <td className="td font-medium">{r.name}</td>
              <td className="td text-slate-600">{r.paperTitle}</td>
              <td className="td font-semibold">{r.score}<span className="font-normal text-slate-400"> / {r.total}</span></td>
              <td className="td text-brand-700">{r.correct}</td>
              <td className="td text-red-700">{r.wrong}</td>
              <td className="td text-slate-500">{r.unanswered}</td>
              {secs.map((s) => {
                const st = r.sections.find((x) => x.section === s);
                return (
                  <td key={s} className="td" title={st ? `Section ${s}: ${st.correct} right, ${st.wrong} wrong, ${st.unanswered} skipped` : ''}>
                    {st ? <><span className="font-medium text-red-700">{st.wrong}</span><span className="ml-1 text-xs text-slate-400">({st.correct} right)</span></> : '-'}
                  </td>
                );
              })}
              <td className="td whitespace-nowrap text-xs text-slate-500">{fmtDateTime(r.submittedAt)}{r.status === 'AUTO_SUBMITTED' ? ' (auto)' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
