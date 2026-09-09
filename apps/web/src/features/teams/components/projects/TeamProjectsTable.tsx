'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TeamProject } from '@/lib/api/endpoints/teams';
import { formatDate } from '@/utils/dates';
import { projectPath } from '@/utils/paths';
import Avatar from '@/components/common/Avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// The projects of the team. A row opens the project in the side panel; the arrow in
// its Actions cell opens the project itself, for the ones the reader is a member of.
export default function TeamProjectsTable({
  projects,
  onSelect,
}: {
  projects: TeamProject[];
  onSelect: (projectId: number) => void;
}) {
  const t = useTranslations('teams');
  const tCommon = useTranslations('common');

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[720px] table-fixed">
        <colgroup>
          <col className="w-[44%]" />
          <col className="w-[16%]" />
          <col className="w-[12%]" />
          <col className="w-[18%]" />
          <col className="w-[10%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-medium text-muted-foreground">
              {t('columns.project')}
            </TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">
              {t('columns.owners')}
            </TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">
              {t('columns.members')}
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
          {projects.map((project) => (
            <TableRow
              key={project.id}
              className="cursor-pointer"
              onClick={() => onSelect(project.id)}
            >
              <TableCell className="px-3 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Badge
                    variant="outline"
                    className="w-12 shrink-0 justify-center rounded px-1 py-0 font-mono text-[10px] text-muted-foreground"
                  >
                    {project.key}
                  </Badge>
                  <span className="truncate text-sm font-medium">{project.name}</span>
                </div>
              </TableCell>

              <TableCell className="px-3 py-3">
                {project.owners.length > 0 && (
                  <span
                    className="flex items-center -space-x-1.5"
                    title={t('panel.owners', {
                      names: project.owners.map((owner) => owner.name).join(', '),
                    })}
                  >
                    {project.owners.map((owner) => (
                      <Avatar
                        key={owner.userId}
                        name={owner.name}
                        image={owner.image}
                        className="ring-2 ring-background"
                      />
                    ))}
                  </span>
                )}
              </TableCell>

              <TableCell className="px-3 py-3 text-sm tabular-nums">
                {project.memberCount}
              </TableCell>

              <TableCell className="px-3 py-3 text-sm text-muted-foreground">
                {formatDate(project.createdAt)}
              </TableCell>

              <TableCell className="px-3 py-2 text-end">
                {project.isMember && (
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground"
                    aria-label={t('panel.openProject')}
                    title={t('panel.openProject')}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link href={projectPath(project.key)}>
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
