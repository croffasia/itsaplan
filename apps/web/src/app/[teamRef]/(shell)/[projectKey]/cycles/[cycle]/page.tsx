import { notFound, redirect } from 'next/navigation';
import RequireFeature from '@/components/common/permissions/RequireFeature';
import CyclesPage from '@/features/cycles/CyclesPage';
import CycleDetailPage from '@/features/cycles/CycleDetailPage';
import { cyclesPath, isCyclesView, projectRefOf } from '@/utils/paths';

// One layout of the cycles list (the grouped table or the day track), or one cycle.
export default async function Page({
  params,
}: {
  params: Promise<{ teamRef: string; projectKey: string; cycle: string }>;
}) {
  const { teamRef, projectKey, cycle } = await params;
  if (isCyclesView(cycle)) {
    return (
      <RequireFeature feature="cycles">
        <CyclesPage view={cycle} />
      </RequireFeature>
    );
  }
  const id = Number(cycle);
  if (!Number.isInteger(id)) redirect(cyclesPath(projectRefOf(teamRef, projectKey)));
  if (id <= 0) notFound();

  return (
    <RequireFeature feature="cycles">
      <CycleDetailPage cycleId={id} />
    </RequireFeature>
  );
}
