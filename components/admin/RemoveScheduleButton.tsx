'use client';
import { useRouter } from 'next/navigation';

export default function RemoveScheduleButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button className="text-sm font-medium text-red-700 hover:underline" onClick={async () => {
      if (!confirm('Remove this paper from the schedule?')) return;
      const r = await fetch(`/api/admin/schedule?id=${id}`, { method: 'DELETE' });
      if (!r.ok) alert((await r.json()).message || 'Failed'); else router.refresh();
    }}>Remove</button>
  );
}

