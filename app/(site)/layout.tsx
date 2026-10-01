import SiteHeader from '@/components/SiteHeader';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-slate-500">
        Best Wishes. All timing is enforced by the server, so refreshing the page or changing your device clock does not help or hurt you.
      </footer>
    </>
  );
}
