import { redirect } from 'next/navigation';
import RequireFeature from '@/components/common/permissions/RequireFeature';
import CyclesPage from '@/features/cycles/CyclesPage';
import { cyclesPath, isCyclesView } from '@/utils/paths';

// One layout of the cycles list: the grouped table or the day track.
export default async function Page({
  params,
}: {
  params: Promise<{ projectKey: string; view: string }>;
}) {
  const { projectKey, view } = await params;
  if (!isCyclesView(view)) redirect(cyclesPath(projectKey));

  return (
    <RequireFeature feature="cycles">
      <CyclesPage view={view} />
    </RequireFeature>
  );
}
