'use client';
import { useRouter } from 'next/navigation';

export default function LogoutButton({ endpoint, redirectTo, label = 'Log out', className = '' }:
  { endpoint: string; redirectTo: string; label?: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      className={className || 'text-sm font-medium text-slate-600 underline-offset-2 hover:underline'}
      onClick={async () => { await fetch(endpoint, { method: 'POST' }); router.push(redirectTo); router.refresh(); }}
    >{label}</button>
  );
}
