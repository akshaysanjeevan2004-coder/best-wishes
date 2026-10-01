import { handle, ok, uuid } from '@/lib/http';
import { requireCandidate } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { loadOwned, syncAttempt } from '@/lib/attempts';
import { computeTiming } from '@/lib/exam';

export const dynamic = 'force-dynamic';

/**
 * Authoritative exam state. The server decides the current section from ITS clock.
 * Only the CURRENT section's questions are ever sent - never future sections, never correct answers.
 */
export const GET = handle(async (_req, { params }) => {
  const cand = await requireCandidate();
  const { attempt, paper } = await loadOwned(uuid(params.id), cand.id);
  const a = await syncAttempt(attempt, paper);
  if (a.status !== 'IN_PROGRESS') return ok({ finished: true, status: a.status, resultUrl: `/result/${a.id}` });

  const now = Date.now();
  const t = computeTiming(Date.parse(a.started_at), now, paper);
  if (t.finished) return ok({ finished: true, status: 'AUTO_SUBMITTED', resultUrl: `/result/${a.id}` }); // defensive

  const qs = must(await db().from('questions')
    .select('id,question_number,question_text,option_a,option_b,option_c,option_d') // NO correct_option
    .eq('paper_id', paper.id).eq('section', t.section).order('question_number')) as Record<string, string | number>[];

  const ans = must(await db().from('answers').select('question_id,selected_option,questions(section)')
    .eq('attempt_id', a.id)) as unknown as { question_id: string; selected_option: number | null; questions: { section: number } | { section: number }[] }[];

  const answers: Record<string, number> = {};
  const answeredBySection: Record<number, number> = {};
  for (const r of ans) {
    if (r.selected_option === null) continue;
    const sec = Array.isArray(r.questions) ? r.questions[0]?.section : r.questions?.section;
    answeredBySection[sec] = (answeredBySection[sec] ?? 0) + 1;
    if (sec === t.section) answers[r.question_id] = r.selected_option;
  }

  return ok({
    finished: false, status: a.status,
    serverNow: now, startedAt: Date.parse(a.started_at),
    section: t.section, sectionCount: paper.section_count, sectionSeconds: paper.section_seconds,
    sectionEndsAt: t.sectionEndsAtMs, examEndsAt: t.examEndsAtMs,
    paperTitle: paper.title, candidateName: a.candidate_name,
    questions: qs.map((q) => ({
      id: q.id, number: q.question_number, text: q.question_text,
      options: [q.option_a, q.option_b, q.option_c, q.option_d],
    })),
    answers,
    sections: Array.from({ length: paper.section_count }, (_, i) => ({
      number: i + 1,
      state: i + 1 < t.section ? 'locked' : i + 1 === t.section ? 'current' : 'upcoming',
      answered: answeredBySection[i + 1] ?? 0,
      total: paper.questions_per_section,
    })),
  });
});
