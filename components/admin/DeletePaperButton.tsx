'use client';
import { useRouter } from 'next/navigation';

export default function DeletePaperButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button className="text-sm font-medium text-red-700 hover:underline" onClick={async () => {
      if (!confirm('Delete this paper and its schedule entries? This cannot be undone.')) return;
      const r = await fetch(`/api/admin/papers?id=${id}`, { method: 'DELETE' });
      if (!r.ok) alert((await r.json()).message || 'Could not delete'); else router.refresh();
    }}>Delete</button>
  );
}
