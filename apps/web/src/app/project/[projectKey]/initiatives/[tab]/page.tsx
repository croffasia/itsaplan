import { redirect } from 'next/navigation';
import RequireFeature from '@/components/common/permissions/RequireFeature';
import InitiativesPage from '@/features/initiatives/InitiativesPage';
import { initiativesPath, isInitiativesTab } from '@/utils/paths';

// One status tab of the initiatives list, "All" included.
export default async function Page({
  params,
}: {
  params: Promise<{ projectKey: string; tab: string }>;
}) {
  const { projectKey, tab } = await params;
  if (!isInitiativesTab(tab)) redirect(initiativesPath(projectKey));

  return (
    <RequireFeature feature="initiatives">
      <InitiativesPage tab={tab} />
    </RequireFeature>
  );
}
