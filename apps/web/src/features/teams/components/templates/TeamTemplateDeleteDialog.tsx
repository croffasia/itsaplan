'use client';

import { useTranslations } from 'next-intl';
import type { ProjectTemplate } from '@/lib/api/endpoints/project-templates';
import { useDeleteProjectTemplate } from '@/services/projectTemplates.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';

export default function TeamTemplateDeleteDialog({
  teamId,
  template,
  onClose,
}: {
  teamId: number;
  template: ProjectTemplate;
  onClose: () => void;
}) {
  const t = useTranslations('teams.templates.deleteDialog');
  const deleteTemplate = useDeleteProjectTemplate(teamId);

  return (
    <ConfirmDialog
      title={t('title', { name: template.name })}
      confirmLabel={t('confirm')}
      onClose={onClose}
      onConfirm={async () => {
        await deleteTemplate.mutateAsync(template.id);
        onClose();
      }}
    >
      <p className="text-sm text-muted-foreground">{t('description')}</p>
    </ConfirmDialog>
  );
}
