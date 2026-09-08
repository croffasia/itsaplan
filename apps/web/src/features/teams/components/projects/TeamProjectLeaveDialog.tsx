'use client';

import { useTranslations } from 'next-intl';
import type { TeamProject } from '@/lib/api/endpoints/teams';
import { useLeaveProject } from '@/services/projects.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';

export default function TeamProjectLeaveDialog({
  project,
  userId,
  onClose,
}: {
  project: TeamProject;
  userId: string;
  onClose: () => void;
}) {
  const t = useTranslations('projects.leaveDialog');
  const leaveProject = useLeaveProject();

  return (
    <ConfirmDialog
      title={t('title', { name: project.name })}
      confirmLabel={t('confirm')}
      onClose={onClose}
      onConfirm={async () => {
        await leaveProject.mutateAsync({ projectKey: project.key, userId });
        onClose();
      }}
    >
      <p className="text-sm text-muted-foreground">
        {t.rich('description', {
          name: project.name,
          strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
        })}
      </p>
    </ConfirmDialog>
  );
}
