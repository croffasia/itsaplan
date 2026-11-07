'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';

// The dialog a template of the workspace is saved and edited in: the form, and beside it
// the template as the new project dialog will show it.
export default function WorkspaceTemplateDialog({
  title,
  crumb,
  form,
  preview,
  canSave,
  onSave,
  onClose,
}: {
  title: string;
  crumb?: string;
  form: ReactNode;
  preview: ReactNode;
  canSave: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('projects.saveTemplate');

  return (
    <Modal title={title} crumb={crumb} onClose={onClose} fullscreen className="pb-3">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto sm:grid-cols-[360px_minmax(0,1fr)] sm:overflow-visible">
          <div className="space-y-4 sm:overflow-y-auto sm:pe-1">{form}</div>
          <div className="min-w-0 sm:overflow-y-auto sm:border-s sm:ps-6">{preview}</div>
        </div>
        <div className="mt-4 flex justify-end border-t pt-3">
          <Button disabled={!canSave} onClick={onSave}>
            {t('save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
