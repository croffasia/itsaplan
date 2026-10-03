'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceScimGroup } from '@/lib/api/endpoints/workspaces';
import { useWorkspaceScimGroupsQuery } from '@/services/workspaces.service';
import SettingsSection from '@/components/common/page/SettingsSection';
import { ItemGroup } from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import WorkspaceScimGroupItem from './WorkspaceScimGroupItem';
import WorkspaceScimGroupMappingDialog from './WorkspaceScimGroupMappingDialog';

// The groups the identity provider has pushed. The list itself is read-only — it is
// the provider's — and what each group grants is set here.
export default function WorkspaceScimGroupList({ workspaceId }: { workspaceId: number }) {
  const t = useTranslations('teams.workspace.scim');
  const groups = useWorkspaceScimGroupsQuery(workspaceId);
  const [editing, setEditing] = useState<WorkspaceScimGroup | null>(null);

  return (
    <SettingsSection title={t('groups')} description={t('groupsHint')}>
      {groups.isPending ? (
        <div className="space-y-2 py-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : groups.data && groups.data.length > 0 ? (
        <ItemGroup>
          {groups.data.map((group) => (
            <WorkspaceScimGroupItem key={group.id} group={group} onEdit={() => setEditing(group)} />
          ))}
        </ItemGroup>
      ) : (
        <p className="py-6 text-sm text-muted-foreground">{t('groupsEmpty')}</p>
      )}

      {editing && (
        <WorkspaceScimGroupMappingDialog
          workspaceId={workspaceId}
          group={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </SettingsSection>
  );
}
