'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectTemplate } from '@/lib/api/endpoints/project-templates';
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
import TeamTemplateDeleteDialog from './TeamTemplateDeleteDialog';
import TeamTemplatePanel from './TeamTemplatePanel';

// The templates of the team. A row opens what the template holds in a side panel.
export default function TeamTemplatesTable({
  teamId,
  templates,
}: {
  teamId: number;
  templates: ProjectTemplate[];
}) {
  const t = useTranslations('teams');
  const tCommon = useTranslations('common');
  const [deleting, setDeleting] = useState<ProjectTemplate | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Read from the list, so the panel closes once its template is deleted.
  const selected = templates.find((template) => template.id === selectedId) ?? null;

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[560px] table-fixed">
        <colgroup>
          <col className="w-[66%]" />
          <col className="w-[20%]" />
          <col className="w-[14%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-medium text-muted-foreground">
              {t('columns.template')}
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
                <p className="text-sm font-medium wrap-anywhere" dir="auto">
                  {template.name}
                </p>
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
              <TableCell className="px-3 py-3 text-sm text-muted-foreground">
                {formatDate(template.createdAt)}
              </TableCell>
              <TableCell className="px-3 py-2 text-end" onClick={(e) => e.stopPropagation()}>
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
        <TeamTemplatePanel
          teamId={teamId}
          template={selected}
          onDelete={() => setDeleting(selected)}
          onClose={() => setSelectedId(null)}
        />
      )}

      {deleting && (
        <TeamTemplateDeleteDialog
          teamId={teamId}
          template={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
