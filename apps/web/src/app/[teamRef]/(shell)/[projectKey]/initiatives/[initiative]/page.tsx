import { notFound, redirect } from 'next/navigation';
import RequireFeature from '@/components/common/permissions/RequireFeature';
import InitiativesPage from '@/features/initiatives/InitiativesPage';
import InitiativeDetailPage from '@/features/initiatives/InitiativeDetailPage';
import { initiativesPath, isInitiativesTab, projectRefOf } from '@/utils/paths';

// One status tab of the initiatives list ("All" included), or one initiative.
export default async function Page({
  params,
}: {
  params: Promise<{ teamRef: string; projectKey: string; initiative: string }>;
}) {
  const { teamRef, projectKey, initiative } = await params;
  if (isInitiativesTab(initiative)) {
    return (
      <RequireFeature feature="initiatives">
        <InitiativesPage tab={initiative} />
      </RequireFeature>
    );
  }
  const id = Number(initiative);
  if (!Number.isInteger(id)) redirect(initiativesPath(projectRefOf(teamRef, projectKey)));
  if (id <= 0) notFound();

  return (
    <RequireFeature feature="initiatives">
      <InitiativeDetailPage initiativeId={id} tab="overview" />
    </RequireFeature>
  );
}
