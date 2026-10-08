'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { Team } from '@/lib/api/endpoints/teams';
import { manageTeamsPath } from '@/utils/paths';
import { useDeleteTeam } from '@/services/teams.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Button } from '@/components/ui/button';

export default function TeamDeleteSection({ team }: { team: Team }) {
  const t = useTranslations('teams.info.delete');
  const router = useRouter();
  const remove = useDeleteTeam();
  const [deleting, setDeleting] = useState(false);
  const blocked = team.projectCount > 0 || team.agentCount > 0;

  return (
    <>
      <SettingsSection
        title={t('action')}
        description={t(blocked ? 'blocked' : 'hint')}
        action={
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-destructive hover:text-destructive"
            disabled={blocked}
            onClick={() => setDeleting(true)}
          >
            {t('action')}
          </Button>
        }
      />

      {deleting && (
        <ConfirmDialog
          title={t('title', { name: team.name })}
          confirmLabel={t('action')}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await remove.mutateAsync(team.id);
            toast.success(t('deleted'));
            router.replace(manageTeamsPath());
          }}
        >
          <p className="text-sm text-muted-foreground">
            {t.rich('description', {
              name: team.name,
              strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
            })}
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
