'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Team } from '@/lib/api/endpoints/teams';
import { manageTeamsPath } from '@/utils/paths';
import { useLeaveTeam } from '@/services/teams.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';

// Leaving the team closes its route, so the page falls back to the first team left.
export default function TeamLeaveDialog({ team, onClose }: { team: Team; onClose: () => void }) {
  const t = useTranslations('teams.leaveDialog');
  const router = useRouter();
  const leaveTeam = useLeaveTeam();

  return (
    <ConfirmDialog
      title={t('title', { name: team.name })}
      confirmLabel={t('confirm')}
      onClose={onClose}
      onConfirm={async () => {
        await leaveTeam.mutateAsync(team.id);
        onClose();
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
  );
}
