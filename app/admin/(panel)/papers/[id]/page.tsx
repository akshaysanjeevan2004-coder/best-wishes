import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase';
import { UUID_RE } from '@/lib/http';
import { textFlags } from '@/lib/flags';
import QuestionImageRow from '@/components/admin/QuestionImageRow';

export const dynamic = 'force-dynamic';

export default async function PaperDetail({ params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) notFound();
  const { data: paper } = await db().from('papers').select('*').eq('id', params.id).maybeSingle();
  if (!paper) notFound();
  const { count } = await db().from('attempts').select('id', { count: 'exact', head: true }).eq('paper_id', paper.id);
  const { data } = await db().from('questions')
    .select('id,question_number,question_text,option_a,option_b,option_c,option_d,image_path,image_whole').eq('paper_id', paper.id).order('question_number');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qs = (data ?? []) as any[];
  const suspicious = qs.filter((q) => !q.image_path && textFlags({ question_text: q.question_text, options: [q.option_a, q.option_b, q.option_c, q.option_d] }).some((f) => f.level === 'image'));
  const withImg = qs.filter((q) => q.image_path).length;
  return (
    <div className="space-y-6">
      <Link href="/admin/papers" className="text-sm font-medium text-brand-700 hover:underline">&larr; All papers</Link>
      <div>
        <h1 className="font-serif text-3xl font-bold text-brand-900">{paper.title}</h1>
        <p className="mt-1 text-slate-600">{qs.length} questions &middot; {withImg} with screenshots. Use this page to add or replace a screenshot for any question.</p>
        {count ? <p className="mt-2 rounded-lg bg-saffron-100 px-3 py-2 text-sm">{count} candidate attempt(s) exist, so questions are locked to keep results fair.</p> : null}
      </div>
      {suspicious.length > 0 && (
        <p className="rounded-lg bg-saffron-100 px-4 py-3 text-sm"><b>Possibly missing a screenshot:</b> Q{suspicious.map((q) => q.question_number).join(', Q')}</p>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="border-b bg-slate-50"><tr><th className="th">Q</th><th className="th">Text</th><th className="th">Screenshot</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {qs.map((q) => (
              <QuestionImageRow key={q.id} paperId={paper.id} locked={!!count}
                q={{ id: q.id, number: q.question_number, text: q.question_text, hasImage: !!q.image_path, whole: q.image_whole !== false }} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
