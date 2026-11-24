'use client';

import { useState } from 'react';
import { Copy, Globe, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  ProjectTemplate,
  WorkspaceProjectTemplate,
} from '@/lib/api/endpoints/project-templates';
import { formatDate } from '@/utils/dates';
import RowAction from '@/components/common/RowAction';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTemplateExport } from '../../hooks/useTemplateExport';
import { useTemplateTeamsLabel } from '../../hooks/useTemplateTeamsLabel';
import WorkspaceTemplateDeleteDialog from './WorkspaceTemplateDeleteDialog';
import WorkspaceTemplateEditModal from './WorkspaceTemplateEditModal';
import WorkspaceTemplatePanel from './WorkspaceTemplatePanel';
import WorkspaceTemplatePublishDialog from './WorkspaceTemplatePublishDialog';
import WorkspaceTemplatePublishedBadge from './WorkspaceTemplatePublishedBadge';

// The templates of the workspace. A row opens what the template holds in a side panel.
export default function WorkspaceTemplatesTable({
  workspaceId,
  templates,
}: {
  workspaceId: number;
  templates: WorkspaceProjectTemplate[];
}) {
  const t = useTranslations('teams');
  const tCommon = useTranslations('common');
  const teamsLabel = useTemplateTeamsLabel();
  const share = useTemplateExport(workspaceId);
  const [editing, setEditing] = useState<ProjectTemplate | null>(null);
  const [deleting, setDeleting] = useState<WorkspaceProjectTemplate | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  // Read from the list, so the panel closes once its template is deleted.
  const selected = templates.find((template) => template.id === selectedId) ?? null;
  const publishing = templates.find((template) => template.id === publishingId) ?? null;

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[640px] table-fixed">
        <colgroup>
          <col className="w-[46%]" />
          <col className="w-[24%]" />
          <col className="w-[18%]" />
          <col className="w-[12%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-medium text-muted-foreground">
              {t('columns.template')}
            </TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">
              {t('templates.teams')}
            </TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">
              {t('columns.created')}
            </TableHead>
            <TableHead className="text-end text-xs font-medium text-muted-foreground">
              {tCommon('actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((template) => (
            <TableRow
              key={template.id}
              className="cursor-pointer"
              onClick={() => setSelectedId(template.id)}
            >
              <TableCell className="px-3 py-3 whitespace-normal">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="min-w-0 text-sm font-medium wrap-anywhere" dir="auto">
                    {template.name}
                  </p>
                  {template.publication && (
                    <WorkspaceTemplatePublishedBadge publication={template.publication} />
                  )}
                </div>
                {template.description && (
                  <p
                    className="line-clamp-1 text-xs wrap-anywhere text-muted-foreground"
                    dir="auto"
                    title={template.description}
                  >
                    {template.description}
                  </p>
                )}
              </TableCell>
              <TableCell className="px-3 py-3 text-sm whitespace-normal text-muted-foreground">
                {teamsLabel(template.teamIds)}
              </TableCell>
              <TableCell className="px-3 py-3 text-sm text-muted-foreground">
                {formatDate(template.createdAt)}
              </TableCell>
              <TableCell className="px-3 py-2 text-end" onClick={(e) => e.stopPropagation()}>
                <RowAction
                  icon={Globe}
                  label={t(
                    template.publication
                      ? 'templates.publish.published'
                      : 'templates.publish.action',
                  )}
                  className={
                    template.publication ? 'text-emerald-600 dark:text-emerald-400' : undefined
                  }
                  onClick={() => setPublishingId(template.id)}
                />
                <RowAction
                  icon={Copy}
                  label={t('templates.copyAction')}
                  onClick={() => void share.copy(template)}
                />
                <RowAction
                  icon={Pencil}
                  label={t('templates.editAction')}
                  onClick={() => setEditing(template)}
                />
                <RowAction
                  icon={Trash2}
                  label={t('templates.deleteAction')}
                  destructive
                  onClick={() => setDeleting(template)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selected && (
        <WorkspaceTemplatePanel
          workspaceId={workspaceId}
          template={selected}
          onEdit={() => setEditing(selected)}
          onPublish={() => setPublishingId(selected.id)}
          onCopy={() => void share.copy(selected)}
          onDownload={() => void share.download(selected)}
          onDelete={() => setDeleting(selected)}
          onClose={() => setSelectedId(null)}
        />
      )}

      {editing && (
        <WorkspaceTemplateEditModal
          workspaceId={workspaceId}
          template={editing}
          onClose={() => setEditing(null)}
        />
      )}

      {publishing && (
        <WorkspaceTemplatePublishDialog
          workspaceId={workspaceId}
          template={publishing}
          onClose={() => setPublishingId(null)}
        />
      )}

      {deleting && (
        <WorkspaceTemplateDeleteDialog
          workspaceId={workspaceId}
          template={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
