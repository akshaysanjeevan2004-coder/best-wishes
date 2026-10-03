'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageAttach from './ImageAttach';

export default function QuestionImageRow({ paperId, q, locked, lang = 'en' }:
  { paperId: string; q: { id: string; number: number; text: string; hasImage: boolean; whole: boolean }; locked: boolean; lang?: 'en' | 'hi' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [whole, setWhole] = useState(q.whole);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function upload(b: Blob) {
    setBusy(true); setErr('');
    const fd = new FormData();
    fd.append('paperId', paperId); fd.append('questionNumber', String(q.number)); fd.append('whole', String(whole)); fd.append('lang', lang); fd.append('file', b, 'q.png');
    const r = await fetch('/api/admin/questions/image', { method: 'POST', body: fd });
    if (!r.ok) setErr((await r.json().catch(() => ({}))).message || 'Upload failed'); else { setOpen(false); router.refresh(); }
    setBusy(false);
  }
  async function remove() {
    if (!confirm(`Remove the screenshot from Q${q.number}?`)) return;
    const r = await fetch(`/api/admin/questions/image?paper=${paperId}&q=${q.number}&lang=${lang}`, { method: 'DELETE' });
    if (!r.ok) alert((await r.json().catch(() => ({}))).message || 'Failed'); else router.refresh();
  }
  async function changeMode(w: boolean) {
    setWhole(w);
    if (!q.hasImage) return;
    const r = await fetch('/api/admin/questions/image', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paperId, questionNumber: q.number, whole: w, lang }) });
    if (!r.ok) alert((await r.json().catch(() => ({}))).message || 'Failed'); else router.refresh();
  }

  return (
    <tr className="align-top">
      <td className="td font-medium">Q{q.number}</td>
      <td className="td max-w-md"><span className="line-clamp-2 text-slate-600">{q.text}</span></td>
      <td className="td">
        {q.hasImage ? <a className="font-medium text-brand-700 hover:underline" href={`/api/admin/images/${q.id}?lang=${lang}`} target="_blank" rel="noreferrer">View screenshot</a> : <span className="text-slate-400">none</span>}
        {q.hasImage && <div className="mt-1 text-xs text-slate-500">{whole ? 'whole question' : 'figure only'}</div>}
      </td>
      <td className="td text-right">
        {locked ? <span className="text-xs text-slate-400">locked (has attempts)</span> : (
          <div className="space-y-2 text-left">
            <div className="flex justify-end gap-3 text-sm font-medium">
              <button className="text-brand-700 hover:underline" onClick={() => setOpen(!open)}>{q.hasImage ? 'Replace' : 'Add screenshot'}</button>
              {q.hasImage && <button className="text-slate-600 hover:underline" onClick={() => changeMode(!whole)}>{whole ? 'Make "figure only"' : 'Make "whole question"'}</button>}
              {q.hasImage && <button className="text-red-700 hover:underline" onClick={remove}>Remove</button>}
            </div>
            {open && (
              <div className="w-72 space-y-2">
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} /> Screenshot includes the options (whole question)</label>
                <ImageAttach onImage={upload} disabled={busy} />
                {busy && <p className="text-xs">Uploading...</p>}
                {err && <p className="text-xs text-red-700">{err}</p>}
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
