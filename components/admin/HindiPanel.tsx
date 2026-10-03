'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { textFlags, type Flag } from '@/lib/flags';
import { prepareImage } from '@/lib/clientImage';
import ImageAttach from './ImageAttach';

type HQ = { question_number: number; question_text: string; options: string[]; correct_option: number | string | null; flags?: Flag[]; page?: number; crop?: string };
type Img = { blob: Blob; url: string; whole: boolean };

export default function HindiPanel({ paperId, locked }: { paperId: string; locked: boolean }) {
  const router = useRouter();
  const [qs, setQs] = useState<HQ[] | null>(null);
  const [images, setImages] = useState<Record<number, Img>>({});
  const [okText, setOkText] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string; details?: string[] } | null>(null);
  const [busy, setBusy] = useState('');

  const info = useMemo(() => {
    const m = new Map<number, { incomplete: boolean; flagged: boolean; reasons: string[] }>();
    (qs ?? []).forEach((q) => {
      const opts = [0, 1, 2, 3].map((i) => (q.options?.[i] ?? '').trim());
      const incomplete = !(q.question_text ?? '').trim() || opts.some((o) => !o);
      const fl = [...(q.flags ?? []), ...textFlags({ question_text: q.question_text ?? '', options: q.options ?? [] })];
      const reasons = [...new Set(fl.filter((f) => f.level === 'image').map((f) => f.reason))];
      if (incomplete) reasons.unshift('Hindi text or an option is missing / unreadable');
      m.set(q.question_number, { incomplete, flagged: reasons.length > 0, reasons });
    });
    return m;
  }, [qs]);

  const resolved = (n: number) => {
    const i = images[n]; const f = info.get(n);
    if (!f) return true;
    if (i && (i.whole || !f.incomplete)) return true;
    return !f.incomplete && okText.has(n);
  };
  const todo = useMemo(() => [...info.entries()].filter(([n, f]) => f.flagged && !resolved(n)).map(([n]) => n).sort((a, b) => a - b), [info, images, okText]); // eslint-disable-line react-hooks/exhaustive-deps
  const flaggedList = useMemo(() => [...info.entries()].filter(([, f]) => f.flagged).map(([n]) => n).sort((a, b) => a - b), [info]);

  function setImage(n: number, blob: Blob, whole = true) {
    setImages((p) => { if (p[n]) URL.revokeObjectURL(p[n].url); return { ...p, [n]: { blob, url: URL.createObjectURL(blob), whole: p[n]?.whole ?? whole } }; });
  }

  async function onJson(f: File | undefined) {
    if (!f) return;
    setMsg(null);
    try {
      const j = JSON.parse(await f.text());
      if (!Array.isArray(j.questions)) throw new Error('No "questions" list in this file.');
      setQs(j.questions); setImages({}); setOkText(new Set());
    } catch (e) { setMsg({ ok: false, text: 'Could not read that file. ' + (e instanceof Error ? e.message : '') }); }
  }

  async function onBulk(files: FileList | null) {
    if (!files) return;
    let matched = 0; const skipped: string[] = [];
    for (const f of Array.from(files)) {
      const n = Number(f.name.match(/q0*(\d{1,3})/i)?.[1]);
      if (!n || !info.has(n)) { skipped.push(f.name); continue; }
      try { setImage(n, await prepareImage(f)); matched++; } catch { skipped.push(f.name); }
    }
    setMsg({ ok: skipped.length === 0, text: `Attached ${matched} screenshot(s) by file name (q051.png -> Q51).${skipped.length ? ` Skipped: ${skipped.slice(0, 5).join(', ')}` : ''}` });
  }

  async function apply() {
    if (!qs) return;
    setMsg(null); setBusy('Saving Hindi text...');
    try {
      const r = await fetch('/api/admin/hindi', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId, questions: qs.map(({ flags: _f, page: _p, crop: _c, ...q }) => q) }) });
      const d = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: d.message || 'Failed', details: d.details }); return; }
      const entries = Object.entries(images).map(([n, i]) => [Number(n), i] as const);
      const failed: number[] = [];
      for (let k = 0; k < entries.length; k++) {
        setBusy(`Uploading Hindi screenshots ${k + 1}/${entries.length}...`);
        const fd = new FormData();
        fd.append('paperId', paperId); fd.append('questionNumber', String(entries[k][0])); fd.append('whole', String(entries[k][1].whole)); fd.append('lang', 'hi'); fd.append('file', entries[k][1].blob, 'q.png');
        try { const u = await fetch('/api/admin/questions/image', { method: 'POST', body: fd }); if (!u.ok) failed.push(entries[k][0]); } catch { failed.push(entries[k][0]); }
      }
      setMsg(failed.length ? { ok: false, text: `Hindi text saved, but screenshots failed for Q${failed.join(', Q')}. Add them in the Hindi table below.` } : { ok: true, text: `Hindi version saved (${d.updated} questions, ${entries.length} screenshots).` });
      setQs(null); router.refresh();
    } catch { setMsg({ ok: false, text: 'Network problem.' }); } finally { setBusy(''); }
  }

  if (locked) return <p className="text-sm text-slate-600">Candidates have already attempted this paper, so the Hindi version can no longer be changed.</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-600">
          Run <code className="rounded bg-slate-100 px-1">python scripts/pdf_to_paper.py &quot;Hindi.pdf&quot;</code> on the Hindi PDF, then upload its <b>paper.json</b> here. Questions are matched by number and the answers must equal the English paper.
          If the Hindi text is garbled, add <code className="rounded bg-slate-100 px-1">--all-images</code> and attach all the crops at once below.
        </p>
        <input type="file" accept=".json" className="mt-2 block text-sm" onChange={(e) => onJson(e.target.files?.[0])} disabled={!!busy} />
      </div>

      {msg && (
        <div role="alert" className={`rounded-lg px-4 py-3 text-sm ${msg.ok ? 'bg-brand-50 text-brand-900' : 'bg-red-50 text-red-900'}`}>
          <p className="font-semibold">{msg.text}</p>
          {msg.details && <ul className="mt-1 list-disc pl-5">{msg.details.slice(0, 15).map((x, i) => <li key={i}>{x}</li>)}</ul>}
        </div>
      )}

      {qs && (
        <div className="space-y-4">
          <p className="text-sm font-medium">{qs.length} Hindi questions read. {flaggedList.length} need a screenshot{todo.length ? ` (${todo.length} still to do)` : ' - all resolved'}.</p>
          <label className="block text-sm font-medium">Attach many screenshots at once (file names like q051.png - e.g. the whole <code>images</code> folder)
            <input type="file" multiple accept="image/png,image/jpeg,image/webp" className="mt-1 block text-sm" onChange={(e) => { onBulk(e.target.files); e.target.value = ''; }} />
          </label>

          <div className="max-h-[32rem] space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">
            {flaggedList.length === 0 && <p className="text-sm text-slate-600">No question needs a screenshot.</p>}
            {flaggedList.map((n) => {
              const q = qs.find((x) => x.question_number === n)!; const f = info.get(n)!; const img = images[n];
              return (
                <div key={n} className={`rounded-lg border p-3 text-sm ${resolved(n) ? 'border-sky-300 bg-sky-50' : 'border-saffron-500 bg-saffron-100'}`}>
                  <p className="font-semibold">Q{n}{q.page ? ` (PDF page ${q.page})` : ''} <span className="font-normal">- {resolved(n) ? 'resolved' : 'TO DO'}</span></p>
                  <p className="text-xs text-slate-700">{f.reasons.join('; ')}</p>
                  <p className="mt-1 line-clamp-2 text-slate-600">{q.question_text}</p>
                  {img ? (
                    <div className="mt-2 space-y-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={`Hindi screenshot Q${n}`} className="max-h-40 rounded border border-slate-300" />
                      <label className="flex items-center gap-2"><input type="radio" checked={img.whole} onChange={() => setImages((p) => ({ ...p, [n]: { ...p[n], whole: true } }))} /> Whole question (includes options)</label>
                      <label className="flex items-center gap-2"><input type="radio" checked={!img.whole} disabled={f.incomplete} onChange={() => setImages((p) => ({ ...p, [n]: { ...p[n], whole: false } }))} /> Only the table/figure</label>
                      <button className="font-medium text-red-700 hover:underline" onClick={() => setImages((p) => { const c = { ...p }; delete c[n]; return c; })}>Remove</button>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <ImageAttach onImage={(b) => setImage(n, b)} />
                      {!f.incomplete && (
                        <label className="flex items-center gap-2"><input type="checkbox" checked={okText.has(n)} onChange={(e) => setOkText((s) => { const c = new Set(s); if (e.target.checked) c.add(n); else c.delete(n); return c; })} /> I checked the PDF: the Hindi text is complete and correct.</label>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {todo.length > 0 && <p className="text-sm font-medium text-red-800">Locked until these are resolved: Q{todo.join(', Q')}</p>}
          <button className="btn btn-primary" disabled={!!busy || todo.length > 0} onClick={apply}>{busy || 'Save Hindi version'}</button>
        </div>
      )}
    </div>
  );
}
