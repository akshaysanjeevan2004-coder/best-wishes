'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const router = useRouter();
  const [u, setU] = useState(''); const [p, setP] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.message || 'Login failed'); return; }
      router.push('/admin'); router.refresh();
    } catch { setErr('Network problem.'); } finally { setBusy(false); }
  }
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={go} className="card w-full max-w-sm space-y-4 p-7">
        <h1 className="font-serif text-2xl font-bold text-brand-900">Best Wishes admin</h1>
        <label className="block text-sm font-medium">Username
          <input className="input mt-1" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" required />
        </label>
        <label className="block text-sm font-medium">Password
          <input className="input mt-1" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required />
        </label>
        {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </div>
  );
}
