import { handle, ok } from '@/lib/http';
import { getTodaysPapers } from '@/lib/queries';
import { todayStr } from '@/lib/config';
export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const papers = await getTodaysPapers();
  return ok({
    date: todayStr(),
    papers: papers.map((p) => ({
      id: p.id, slot: p.slot, title: p.title, description: p.description,
      totalQuestions: p.total_questions, sections: p.section_count,
      minutes: (p.section_count * p.section_seconds) / 60,
    })),
  });
});
