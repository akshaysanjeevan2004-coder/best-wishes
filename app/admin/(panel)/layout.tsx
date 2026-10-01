import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import LogoutButton from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!isAdmin()) redirect('/admin/login');
  const link = 'font-medium text-slate-700 hover:text-brand-700';
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="font-serif text-xl font-bold text-brand-800">Best Wishes <span className="text-sm font-normal text-slate-500">admin</span></span>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/admin" className={link}>Dashboard</Link>
            <Link href="/admin/papers" className={link}>Papers</Link>
            <Link href="/admin/schedule" className={link}>Schedule</Link>
            <Link href="/admin/results" className={link}>Results</Link>
            <Link href="/" className="text-slate-500 hover:underline">View site</Link>
            <LogoutButton endpoint="/api/admin/logout" redirectTo="/admin/login" />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
