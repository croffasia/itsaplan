'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { WorkspaceManager } from '@/lib/api/endpoints/workspaces';
import {
  useRemoveWorkspaceAdmin,
  useWorkspaceManagersQuery,
  useWorkspaceQuery,
} from '@/services/workspaces.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import SectionPageView from '@/components/common/page/SectionPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import WorkspaceAdminAddDialog from './WorkspaceAdminAddDialog';
import WorkspaceManagerRow from './WorkspaceManagerRow';

// The owner and the admins. Only the owner appoints and removes admins.
export default function WorkspaceManagersSection({ workspaceId }: { workspaceId: number }) {
  const t = useTranslations('teams.workspace');
  const tCommon = useTranslations('common');
  const isOwner = useWorkspaceQuery(workspaceId).data?.role === 'owner';
  const managersQuery = useWorkspaceManagersQuery(workspaceId);
  const remove = useRemoveWorkspaceAdmin(workspaceId);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<WorkspaceManager | null>(null);

  return (
    <SectionPageView
      title={t('managers.title')}
      description={isOwner ? t('managers.description') : t('managers.ownerOnly')}
      wide
      actions={
        isOwner ? (
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" />
            {t('managers.addAction')}
          </Button>
        ) : undefined
      }
    >
      {managersQuery.isPending ? (
        <ListSkeleton rows={2} rowClassName="h-12" />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[560px] table-fixed">
            <colgroup>
              <col className="w-[60%]" />
              <col className="w-[25%]" />
              <col className="w-[15%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground">
                  {t('managers.person')}
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  {t('managers.role')}
                </TableHead>
                <TableHead className="text-end text-xs font-medium text-muted-foreground">
                  {tCommon('actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(managersQuery.data ?? []).map((manager) => (
                <WorkspaceManagerRow
                  key={manager.userId}
                  manager={manager}
                  onRemove={isOwner && manager.role === 'admin' ? setRemoving : undefined}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {adding && (
        <WorkspaceAdminAddDialog workspaceId={workspaceId} onClose={() => setAdding(false)} />
      )}

      {removing && (
        <ConfirmDialog
          title={t('managers.removeTitle', { name: removing.name || removing.email })}
          confirmLabel={t('managers.removeAction')}
          onConfirm={async () => {
            await remove.mutateAsync(removing.userId);
            setRemoving(null);
            toast.success(t('managers.removed', { name: removing.name || removing.email }));
          }}
          onClose={() => setRemoving(null)}
        >
          <div className="text-sm text-muted-foreground">{t('managers.removeDescription')}</div>
        </ConfirmDialog>
      )}
    </SectionPageView>
  );
}
