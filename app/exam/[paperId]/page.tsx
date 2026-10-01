import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getCandidate } from '@/lib/auth';
import { db } from '@/lib/supabase';
import { getPaper, isScheduledToday } from '@/lib/queries';
import { UUID_RE } from '@/lib/http';
import ExamClient from '@/components/ExamClient';

export const dynamic = 'force-dynamic';

export default async function ExamPage({ params }: { params: { paperId: string } }) {
  const cand = await getCandidate();
  if (!cand) redirect('/');
  if (!UUID_RE.test(params.paperId)) notFound();
  const paper = await getPaper(params.paperId);
  if (!paper) notFound();

  const { data: att } = await db().from('attempts').select('id,status')
    .eq('candidate_id', cand.id).eq('paper_id', paper.id).maybeSingle();
  if (att && att.status !== 'IN_PROGRESS') redirect(`/result/${att.id}`);

  if (!att && !(await isScheduledToday(paper.id))) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-serif text-2xl font-bold">This test is not available today</h1>
        <p className="mt-2 text-slate-600">Only tests scheduled for today can be started.</p>
        <Link href="/" className="btn btn-primary mt-6">Back to today&apos;s tests</Link>
      </div>
    );
  }

  return (
    <ExamClient
      paper={{ id: paper.id, title: paper.title, totalQuestions: paper.total_questions, sections: paper.section_count,
        perSection: paper.questions_per_section, sectionMinutes: paper.section_seconds / 60 }}
      candidateName={cand.name}
      initialAttemptId={att?.id ?? null}
    />
  );
}
