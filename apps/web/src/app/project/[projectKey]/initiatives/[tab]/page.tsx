import { redirect } from 'next/navigation';
import RequireFeature from '@/components/common/permissions/RequireFeature';
import InitiativesPage from '@/features/initiatives/InitiativesPage';
import { initiativesPath, isInitiativesTab } from '@/utils/paths';

// One status tab of the initiatives list. A segment that names no tab goes back to
// the list ("All" lives at /initiatives, not /initiatives/all).
export default async function Page({
  params,
}: {
  params: Promise<{ projectKey: string; tab: string }>;
}) {
  const { projectKey, tab } = await params;
  if (tab === 'all' || !isInitiativesTab(tab)) redirect(initiativesPath(projectKey));

  return (
    <RequireFeature feature="initiatives">
      <InitiativesPage tab={tab} />
    </RequireFeature>
  );
}
