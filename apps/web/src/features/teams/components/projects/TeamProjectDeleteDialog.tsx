'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TeamProject } from '@/lib/api/endpoints/teams';
import { useDeleteTeamProject } from '@/services/projects.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { Input } from '@/components/ui/input';

export default function TeamProjectDeleteDialog({
  teamId,
  project,
  onClose,
}: {
  teamId: number;
  project: TeamProject;
  onClose: () => void;
}) {
  const t = useTranslations('projects.deleteDialog');
  const [confirmText, setConfirmText] = useState('');
  const deleteProject = useDeleteTeamProject();
  const matches = confirmText.trim() === project.key;

  return (
    <ConfirmDialog
      title={t('title', { name: project.name })}
      confirmLabel={t('confirm')}
      confirmDisabled={!matches}
      onClose={onClose}
      onConfirm={async () => {
        await deleteProject.mutateAsync({ teamId, projectId: project.id, projectKey: project.key });
        onClose();
      }}
    >
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          {t.rich('description', {
            name: project.name,
            strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
          })}
        </p>
        <p>
          {t.rich('typeToConfirm', {
            key: project.key,
            code: (chunks) => (
              <span className="font-mono font-medium text-foreground">{chunks}</span>
            ),
          })}
        </p>
      </div>
      <Input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={project.key}
        autoFocus
      />
    </ConfirmDialog>
  );
}
