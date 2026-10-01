'use client';
import { useRef, useState } from 'react';
import { prepareImage } from '@/lib/clientImage';

/** Paste a screenshot (Ctrl/Cmd+V) or choose an image file. Large images are shrunk in the browser first. */
export default function ImageAttach({ onImage, disabled }: { onImage: (b: Blob) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  async function take(f: Blob | undefined | null) {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('That is not an image.'); return; }
    try { setErr(''); onImage(await prepareImage(f)); } catch { setErr('Could not read that image.'); }
  }
  return (
    <div>
      <div tabIndex={0} onPaste={(e) => { const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); take(f); } }}
        className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center text-sm text-slate-600 outline-none focus:border-brand-600 focus:bg-brand-50">
        Click here, then <b>paste your screenshot</b> (Ctrl+V / Cmd+V) &nbsp;or&nbsp;
        <button type="button" disabled={disabled} className="font-semibold text-brand-700 underline" onClick={() => input.current?.click()}>choose an image file</button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {err && <p role="alert" className="mt-1 text-sm text-red-700">{err}</p>}
    </div>
  );
}
