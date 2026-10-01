'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SchedulePanel({ papers, today }: { papers: { id: string; title: string }[]; today: string }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState(1);
  const [paperId, setPaperId] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string; details?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/admin/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, slot, paperId }) });
      const d = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: d.message || 'Failed', details: d.details }); return; }
      setMsg({ ok: true, text: `Scheduled for ${date}, slot ${slot}.` }); router.refresh();
    } catch { setMsg({ ok: false, text: 'Network problem.' }); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-6">
      <p className="text-sm text-slate-600">Each date has two slots. Saving into an occupied slot replaces the paper in it. A third paper on one day is not possible.</p>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm font-medium">Date<input type="date" className="input mt-1" min={today} value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <label className="text-sm font-medium">Slot
          <select className="input mt-1" value={slot} onChange={(e) => setSlot(Number(e.target.value))}><option value={1}>Paper 1</option><option value={2}>Paper 2</option></select></label>
        <label className="text-sm font-medium">Paper
          <select className="input mt-1" value={paperId} onChange={(e) => setPaperId(e.target.value)} required>
            <option value="">- choose a paper -</option>{papers.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
      </div>
      {msg && (
        <div role="alert" className={`rounded-lg px-4 py-3 text-sm ${msg.ok ? 'bg-brand-50 text-brand-900' : 'bg-red-50 text-red-900'}`}>
          <p className="font-semibold">{msg.text}</p>
          {msg.details && <ul className="mt-1 list-disc pl-5">{msg.details.map((x, i) => <li key={i}>{x}</li>)}</ul>}
        </div>
      )}
      <button className="btn btn-primary" disabled={busy || !paperId}>{busy ? 'Saving...' : 'Save schedule'}</button>
    </form>
  );
}
