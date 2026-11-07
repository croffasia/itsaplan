'use client';

import { useTranslations } from 'next-intl';
import { useUnpublishTemplate } from '@/services/projectTemplates.service';
import { Button } from '@/components/ui/button';

// Asks before the gallery page goes down, because its link stops working.
export default function WorkspaceTemplateUnpublishConfirm({
  workspaceId,
  templateId,
  onDone,
}: {
  workspaceId: number;
  templateId: number;
  onDone: () => void;
}) {
  const t = useTranslations('teams.templates.publish');
  const unpublish = useUnpublishTemplate(workspaceId);

  return (
    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 py-2.5 ps-3.5 pe-2.5">
      <div className="min-w-0 flex-1 text-[13px]">
        <p className="font-medium">{t('unpublishConfirm')}</p>
        <p className="text-muted-foreground">{t('unpublishHint')}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={onDone}>
        {t('keep')}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={unpublish.isPending}
        onClick={() => unpublish.mutate(templateId, { onSuccess: onDone })}
      >
        {t('unpublish')}
      </Button>
    </div>
  );
}
