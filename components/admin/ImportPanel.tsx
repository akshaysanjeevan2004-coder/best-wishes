'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateQuestions, normCorrect, type DraftQ } from '@/lib/validate';

type Draft = { title: string; description: string; source_filename: string; correct_marks: number; wrong_marks: number; section_seconds: number; questions: DraftQ[] };
const L = ['A', 'B', 'C', 'D'];

export default function ImportPanel() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [parseReport, setParseReport] = useState<{ errors: string[]; warnings: string[] } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; details?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const problems = useMemo(() => (draft ? validateQuestions(draft.questions) : []), [draft]);
  const badNumbers = useMemo(() => new Set(problems.map((p) => Number(p.match(/Question (\d+)/)?.[1])).filter(Boolean)), [problems]);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setMsg(null); setParseReport(null); setBusy(true);
    try {
      if (/\.json$/i.test(f.name)) {
        const j = JSON.parse(await f.text());
        setDraft({ title: j.title ?? '', description: j.description ?? '', source_filename: f.name, correct_marks: j.correct_marks ?? 1, wrong_marks: j.wrong_marks ?? 0, section_seconds: j.section_seconds ?? 900, questions: j.questions ?? [] });
      } else {
        const fd = new FormData(); fd.append('file', f);
        const r = await fetch('/api/admin/parse', { method: 'POST', body: fd });
        const d = await r.json();
        if (!r.ok) { setMsg({ ok: false, text: d.message || 'Could not read the file.' }); return; }
        setDraft({ title: d.title || f.name.replace(/\.\w+$/, ''), description: '', source_filename: d.source_filename, correct_marks: 1, wrong_marks: 0, section_seconds: 900, questions: d.questions });
        setParseReport({ errors: d.errors, warnings: d.warnings });
      }
    } catch (e) { setMsg({ ok: false, text: 'Could not read that file. ' + (e instanceof Error ? e.message : '') }); }
    finally { setBusy(false); }
  }

  function edit(i: number, patch: Partial<DraftQ>) {
    setDraft((d) => d && { ...d, questions: d.questions.map((q, k) => (k === i ? { ...q, ...patch } : q)) });
  }

  async function doImport() {
    if (!draft) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/admin/papers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const d = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: d.message || 'Import failed.', details: d.details }); return; }
      setMsg({ ok: true, text: `Paper imported successfully. Questions: ${d.questions}  Sections: ${d.sections}` });
      setDraft(null); setParseReport(null); router.refresh();
    } catch { setMsg({ ok: false, text: 'Network problem.' }); } finally { setBusy(false); }
  }

  return (
    <section className="card space-y-5 p-6">
      <div>
        <h2 className="font-serif text-xl font-bold">Import a paper</h2>
        <p className="mt-1 text-sm text-slate-600">Upload a question-paper <b>PDF</b> (text-based, up to 4 MB), a <b>.txt</b> file, or a ready <b>.json</b>. You can review and fix every question before it is saved.</p>
        <input type="file" accept=".pdf,.txt,.json" className="mt-3 block text-sm" onChange={(e) => onFile(e.target.files?.[0])} disabled={busy} />
      </div>

      {msg && (
        <div role="alert" className={`rounded-lg px-4 py-3 text-sm ${msg.ok ? 'bg-brand-50 text-brand-900' : 'bg-red-50 text-red-900'}`}>
          <p className="font-semibold">{msg.text}</p>
          {msg.details && <ul className="mt-1 list-disc pl-5">{msg.details.slice(0, 15).map((x, i) => <li key={i}>{x}</li>)}</ul>}
        </div>
      )}

      {draft && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium">Paper title *<input className="input mt-1" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
            <label className="text-sm font-medium">Description<input className="input mt-1" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
            <label className="text-sm font-medium">Marks per correct answer<input className="input mt-1" type="number" step="0.25" value={draft.correct_marks} onChange={(e) => setDraft({ ...draft, correct_marks: Number(e.target.value) })} /></label>
            <label className="text-sm font-medium">Marks per wrong answer (0 or negative, e.g. -0.5)<input className="input mt-1" type="number" step="0.25" max={0} value={draft.wrong_marks} onChange={(e) => setDraft({ ...draft, wrong_marks: Number(e.target.value) })} /></label>
            <label className="text-sm font-medium">Seconds per section (900 = 15 min; use 20 only for timer testing)<input className="input mt-1" type="number" min={10} max={3600} value={draft.section_seconds} onChange={(e) => setDraft({ ...draft, section_seconds: Number(e.target.value) })} /></label>
          </div>

          {parseReport && (parseReport.errors.length > 0 || parseReport.warnings.length > 0) && (
            <details open className="rounded-lg border border-saffron-500/50 bg-saffron-100 p-3 text-sm">
              <summary className="cursor-pointer font-semibold">Parser report: {parseReport.errors.length} problem(s), {parseReport.warnings.length} warning(s)</summary>
              <ul className="mt-2 list-disc space-y-0.5 pl-5">{[...parseReport.errors, ...parseReport.warnings].slice(0, 40).map((x, i) => <li key={i}>{x}</li>)}</ul>
            </details>
          )}

          <div className={`rounded-lg px-4 py-3 text-sm ${problems.length ? 'bg-red-50 text-red-900' : 'bg-brand-50 text-brand-900'}`}>
            {problems.length === 0
              ? <b>Ready: {draft.questions.length} questions, 4 sections x 25, all options and answers present.</b>
              : <><b>{problems.length} issue(s) to fix before import:</b><ul className="mt-1 list-disc pl-5">{problems.slice(0, 10).map((x, i) => <li key={i}>{x}</li>)}</ul>{problems.length > 10 && <p>...and {problems.length - 10} more. Click a highlighted question number below to fix it.</p>}</>}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {draft.questions.map((q, i) => (
              <button key={i} onClick={() => setOpen(open === i ? null : i)}
                className={`h-8 min-w-8 rounded border px-1.5 text-xs font-semibold ${badNumbers.has(q.question_number) ? 'border-red-600 bg-red-50 text-red-800' : 'border-slate-300 bg-white text-slate-600'} ${open === i ? 'ring-2 ring-brand-600' : ''}`}>
                {q.question_number}
              </button>
            ))}
          </div>

          {open !== null && draft.questions[open] && (() => {
            const q = draft.questions[open];
            return (
              <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-semibold">Question {q.question_number}</p>
                <textarea className="input min-h-20" value={q.question_text} onChange={(e) => edit(open, { question_text: e.target.value })} />
                {L.map((l, k) => (
                  <label key={l} className="flex items-center gap-2 text-sm"><span className="w-5 font-bold">{l}</span>
                    <input className="input" value={q.options[k] ?? ''} onChange={(e) => edit(open, { options: q.options.map((o, z) => (z === k ? e.target.value : o)) })} /></label>
                ))}
                <label className="flex items-center gap-2 text-sm font-medium">Correct answer
                  <select className="input !w-auto" value={normCorrect(q.correct_option) ?? ''} onChange={(e) => edit(open, { correct_option: e.target.value === '' ? null : Number(e.target.value) })}>
                    <option value="">- choose -</option>{L.map((l, k) => <option key={l} value={k}>{l}</option>)}
                  </select></label>
              </div>
            );
          })()}

          <button className="btn btn-primary" disabled={busy || problems.length > 0 || !draft.title.trim()} onClick={doImport}>{busy ? 'Importing...' : 'Import paper'}</button>
        </div>
      )}
    </section>
  );
}
