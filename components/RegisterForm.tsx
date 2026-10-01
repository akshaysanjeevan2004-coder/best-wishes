'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterForm() {
  const router = useRouter();
  const [f, setF] = useState({ name: '', mobile: '', email: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const d = await r.json();
      if (!r.ok) { setErr(d.message || 'Could not continue.'); return; }
      router.refresh();
    } catch { setErr('Network problem. Please try again.'); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <h2 className="font-serif text-xl font-bold">Enter your details to continue</h2>
        <p className="mt-1 text-sm text-slate-600">Your name appears on the results board. Mobile and email stay private.</p>
      </div>
      <label className="block text-sm font-medium">Full name
        <input className="input mt-1" required minLength={2} maxLength={80} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </label>
      <label className="block text-sm font-medium">Mobile number
        <input className="input mt-1" required inputMode="numeric" autoComplete="tel" placeholder="10-digit number" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} />
      </label>
      <label className="block text-sm font-medium">Email ID
        <input className="input mt-1" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </label>
      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Please wait...' : 'Enter'}</button>
    </form>
  );
}
