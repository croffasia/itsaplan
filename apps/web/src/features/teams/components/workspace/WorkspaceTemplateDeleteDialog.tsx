'use client';

import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { WorkspaceProjectTemplate } from '@/lib/api/endpoints/project-templates';
import { useDeleteProjectTemplate } from '@/services/projectTemplates.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';

export default function WorkspaceTemplateDeleteDialog({
  workspaceId,
  template,
  onClose,
}: {
  workspaceId: number;
  template: WorkspaceProjectTemplate;
  onClose: () => void;
}) {
  const t = useTranslations('teams.templates.deleteDialog');
  const deleteTemplate = useDeleteProjectTemplate(workspaceId);

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
      {template.publication && (
        <p className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm">
          <Globe className="size-4 shrink-0 text-destructive" />
          {t('galleryNote')}
        </p>
      )}
    </ConfirmDialog>
  );
}
