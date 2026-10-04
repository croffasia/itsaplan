'use client';

import { useTranslations } from 'next-intl';
import { useWorkspaceScimQuery } from '@/services/workspaces.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import WorkspaceScimSettings from './WorkspaceScimSettings';

// SCIM provisioning: the token an identity provider authenticates with, and what the
// groups it pushes grant. Nothing here is a form the owner fills in and saves — the
// switch and the token act on their own — so there is no page-level Save.
export default function WorkspaceScimSection({ workspaceId }: { workspaceId: number }) {
  const t = useTranslations('teams.workspace.scim');
  const settings = useWorkspaceScimQuery(workspaceId).data;

  return (
    <SectionPageView title={t('title')} description={t('description')}>
      {settings ? (
        <WorkspaceScimSettings workspaceId={workspaceId} settings={settings} />
      ) : (
        <ListSkeleton rows={5} rowClassName="h-12" />
      )}
    </SectionPageView>
  );
}
