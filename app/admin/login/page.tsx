import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import AdminLogin from '@/components/admin/AdminLogin';

export const dynamic = 'force-dynamic';
export default function Page() {
  if (isAdmin()) redirect('/admin');
  return <AdminLogin />;
}
