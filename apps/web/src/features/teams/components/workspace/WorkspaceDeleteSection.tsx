'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { manageTeamsPath } from '@/utils/paths';
import type { Workspace } from '@/lib/api/endpoints/workspaces';
import { useDeleteWorkspace } from '@/services/workspaces.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Button } from '@/components/ui/button';

export default function WorkspaceDeleteSection({ workspace }: { workspace: Workspace }) {
  const t = useTranslations('teams.workspace');
  const router = useRouter();
  const remove = useDeleteWorkspace(workspace.id);
  const [deleting, setDeleting] = useState(false);
  const blocked = workspace.deletion === 'work';

  return (
    <>
      <SettingsSection
        title={t('delete.action')}
        description={t(blocked ? 'delete.blocked' : 'delete.hint')}
        action={
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-destructive hover:text-destructive"
            disabled={blocked}
            onClick={() => setDeleting(true)}
          >
            {t('delete.action')}
          </Button>
        }
      />

      {deleting && (
        <ConfirmDialog
          title={t('delete.title', { name: workspace.name })}
          confirmLabel={t('delete.action')}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await remove.mutateAsync();
            toast.success(t('delete.deleted'));
            router.replace(manageTeamsPath());
          }}
        >
          <p className="text-sm text-muted-foreground">
            {t.rich('delete.description', {
              name: workspace.name,
              strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
            })}
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
