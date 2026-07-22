'use client';

import { Pencil } from 'lucide-react';
import type { InstanceProject } from '@/lib/api';
import { formatShortDate } from '@/utils/dates';
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
import { compactCount } from '../../utils/numbers';

// The project list. A row (or the pencil in its Actions cell) opens the project in
// the side panel, where the full counts and the member list are. The columns here
// are the ones that say how much is going on: work, people, activity.
export default function GodProjectsTable({
  projects,
  onSelect,
}: {
  projects: InstanceProject[];
  onSelect: (projectId: number) => void;
}) {
  return (
    <Table className="min-w-[900px] table-fixed">
      <colgroup>
        <col className="w-[36%]" />
        <col className="w-[10%]" />
        <col className="w-[12%]" />
        <col className="w-[10%]" />
        <col className="w-[13%]" />
        <col className="w-[11%]" />
        <col className="w-[8%]" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-xs font-medium text-muted-foreground">Project</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Members</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Issues</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Agents</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Last activity</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">MCP</TableHead>
          <TableHead className="text-right text-xs font-medium text-muted-foreground">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((p) => (
          <TableRow
            key={p.id}
            className="cursor-pointer"
            onClick={() => onSelect(p.id)}
            title="Show project details"
          >
            <TableCell className="px-3 py-3 align-top whitespace-normal">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">
                    {p.key}
                  </span>
                  <span className="truncate text-sm font-medium">{p.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  created {formatShortDate(p.createdAt)}
                </span>
              </div>
            </TableCell>

            <TableCell
              className="px-3 py-3 align-top text-sm tabular-nums"
              title={String(p.memberCount)}
            >
              {compactCount(p.memberCount)}
            </TableCell>

            <TableCell className="px-3 py-3 align-top text-sm tabular-nums">
              <div className="flex flex-col gap-0.5">
                <span title={String(p.issueCount)}>{compactCount(p.issueCount)}</span>
                {/* Its own line, so a project with five-digit counts does not push the
                    column into a wrap. */}
                {p.archivedIssueCount > 0 && (
                  <span
                    className="text-xs text-muted-foreground"
                    title={`${p.archivedIssueCount} archived`}
                  >
                    {compactCount(p.archivedIssueCount)} archived
                  </span>
                )}
              </div>
            </TableCell>

            <TableCell
              className="px-3 py-3 align-top text-sm tabular-nums"
              title={String(p.agentCount)}
            >
              {compactCount(p.agentCount)}
            </TableCell>

            <TableCell className="px-3 py-3 align-top text-xs text-muted-foreground">
              {p.lastActivityAt ? formatShortDate(p.lastActivityAt) : 'never'}
            </TableCell>

            <TableCell className="px-3 py-3 align-top">
              {p.mcpEnabled ? (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">
                  Enabled
                </Badge>
              ) : (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium">
                  Off
                </Badge>
              )}
            </TableCell>

            <TableCell className="px-3 py-3 text-right align-top">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label="Open project"
                title="Open project"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(p.id);
                }}
              >
                <Pencil />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
