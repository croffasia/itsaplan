import { notFound } from 'next/navigation';
import RequireFeature from '@/components/common/permissions/RequireFeature';
import CycleDetailPage from '@/features/cycles/CycleDetailPage';

export default async function Page({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  const id = Number(cycleId);
  if (!Number.isInteger(id)) notFound();

  return (
    <RequireFeature feature="cycles">
      <CycleDetailPage cycleId={id} />
    </RequireFeature>
  );
}
