import { db, must } from '@/lib/supabase';
import { fmtDateTime } from '@/lib/config';
import ImportPanel from '@/components/admin/ImportPanel';
import DeletePaperButton from '@/components/admin/DeletePaperButton';

export const dynamic = 'force-dynamic';

export default async function PapersPage() {
  const papers = must(await db().from('papers').select('*').order('created_at', { ascending: false })) as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    <div className="space-y-10">
      <h1 className="font-serif text-3xl font-bold text-brand-900">Papers</h1>
      <ImportPanel />
      <section>
        <h2 className="font-serif text-xl font-bold">Imported papers ({papers.length})</h2>
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b bg-slate-50"><tr><th className="th">Title</th><th className="th">Questions</th><th className="th">Marking</th><th className="th">Imported</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {papers.map((p) => (
                <tr key={p.id}>
                  <td className="td font-medium">{p.title}<div className="text-xs font-normal text-slate-500">{p.source_filename}</div></td>
                  <td className="td">{p.total_questions} ({p.section_count} x {p.questions_per_section})</td>
                  <td className="td text-sm">+{Number(p.correct_marks)} / {Number(p.wrong_marks)}</td>
                  <td className="td text-xs text-slate-500">{fmtDateTime(p.created_at)}</td>
                  <td className="td text-right"><DeletePaperButton id={p.id} /></td>
                </tr>
              ))}
              {papers.length === 0 && <tr><td className="td text-slate-500" colSpan={5}>No papers yet. Import one above.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
