'use client';

import { Copy, Download, Globe, LayoutTemplate, Pencil, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { WorkspaceProjectTemplate } from '@/lib/api/endpoints/project-templates';
import { useExitOnEscape } from '@/hooks/useExitOnEscape';
import ProjectTemplateDetails from '@/components/common/project-template/ProjectTemplateDetails';
import RowAction from '@/components/common/RowAction';
import { Button } from '@/components/ui/button';
import { useTemplateTeamsLabel } from '../../hooks/useTemplateTeamsLabel';
import WorkspaceTemplatePublishedBadge from './WorkspaceTemplatePublishedBadge';

// One template of the workspace: the teams that see it and what a project created from it
// starts with.
export default function WorkspaceTemplatePanel({
  workspaceId,
  template,
  onEdit,
  onPublish,
  onCopy,
  onDownload,
  onDelete,
  onClose,
}: {
  workspaceId: number;
  template: WorkspaceProjectTemplate;
  onEdit: () => void;
  onPublish: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('teams');
  const tCommon = useTranslations('common');
  const teamsLabel = useTemplateTeamsLabel();

  useExitOnEscape(onClose);

  return (
    <div
      className="fixed inset-0 z-40 flex bg-black/20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ms-auto flex h-full w-full flex-col border-s bg-card sm:w-[680px] sm:max-w-[92vw]">
        <div className="flex shrink-0 items-center justify-between gap-3 bg-muted/30 px-6 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <LayoutTemplate className="size-4 shrink-0 text-muted-foreground" />
            <h2 className="truncate text-base font-semibold" dir="auto">
              {template.name}
            </h2>
            {template.publication && (
              <WorkspaceTemplatePublishedBadge publication={template.publication} />
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={onClose}
            title={tCommon('close')}
          >
            <X />
          </Button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-6 py-6">
          <p className="text-xs text-muted-foreground">
            {t('templates.panel.teams', { teams: teamsLabel(template.teamIds) })}
          </p>
          <ProjectTemplateDetails scope={{ workspaceId }} template={template} />
        </div>

        <div className="flex shrink-0 items-center gap-1 border-t px-6 py-3">
          <Button
            variant="ghost"
            size="sm"
            className={template.publication ? 'text-foreground' : 'text-muted-foreground'}
            onClick={onPublish}
          >
            {template.publication ? (
              <span className="mx-0.5 size-2 rounded-full bg-emerald-500" />
            ) : (
              <Globe />
            )}
            {t(template.publication ? 'templates.publish.published' : 'templates.publish.action')}
          </Button>
          <div className="ms-auto flex items-center gap-1">
            <RowAction icon={Pencil} label={t('templates.editAction')} onClick={onEdit} />
            <RowAction icon={Copy} label={t('templates.copyAction')} onClick={onCopy} />
            <RowAction icon={Download} label={t('templates.downloadAction')} onClick={onDownload} />
            <RowAction
              icon={Trash2}
              label={t('templates.deleteAction')}
              destructive
              onClick={onDelete}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
