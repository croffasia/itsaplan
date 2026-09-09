'use client';

import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InstanceTeam } from '@/lib/api/endpoints/god';
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

// The team list. A row (or the pencil in its Actions cell) opens the team in the side
// panel, where the full counts, the projects and the member list are.
export default function GodTeamsTable({
  teams,
  onSelect,
}: {
  teams: InstanceTeam[];
  onSelect: (teamId: number) => void;
}) {
  const t = useTranslations('god.teams');
  const tCommon = useTranslations('common');

  return (
    <Table className="min-w-[900px] table-fixed">
      <colgroup>
        <col className="w-[34%]" />
        <col className="w-[11%]" />
        <col className="w-[11%]" />
        <col className="w-[11%]" />
        <col className="w-[11%]" />
        <col className="w-[14%]" />
        <col className="w-[8%]" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('columns.team')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('columns.projects')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('columns.members')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('columns.issues')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('columns.agents')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('columns.mcp')}
          </TableHead>
          <TableHead className="text-right text-xs font-medium text-muted-foreground">
            {tCommon('actions')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teams.map((team) => (
          <TableRow
            key={team.id}
            className="cursor-pointer"
            onClick={() => onSelect(team.id)}
            title={t('showDetails')}
          >
            <TableCell className="px-3 py-3">
              <span className="truncate text-sm font-medium">{team.name}</span>
            </TableCell>

            <TableCell className="px-3 py-3 text-sm tabular-nums" title={String(team.projectCount)}>
              {compactCount(team.projectCount)}
            </TableCell>

            <TableCell className="px-3 py-3 text-sm tabular-nums" title={String(team.memberCount)}>
              {compactCount(team.memberCount)}
            </TableCell>

            <TableCell className="px-3 py-3 text-sm tabular-nums" title={String(team.issueCount)}>
              {compactCount(team.issueCount)}
            </TableCell>

            <TableCell className="px-3 py-3 text-sm tabular-nums" title={String(team.agentCount)}>
              {compactCount(team.agentCount)}
            </TableCell>

            <TableCell className="px-3 py-3">
              <Badge
                variant={team.mcpEnabled ? 'secondary' : 'outline'}
                className="px-1.5 py-0 text-[10px] font-medium"
              >
                {t(team.mcpEnabled ? 'mcpEnabled' : 'mcpOff')}
              </Badge>
            </TableCell>

            <TableCell className="px-3 py-3 text-right">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label={t('open')}
                title={t('open')}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(team.id);
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
