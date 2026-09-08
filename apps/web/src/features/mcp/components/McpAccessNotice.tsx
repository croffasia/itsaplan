'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { TeamRole } from '@/lib/api/endpoints/teams';
import { teamSectionPath } from '@/utils/paths';
import { useTeamQuery } from '@/services/teams.service';
import { Skeleton } from '@/components/ui/skeleton';

// Why the project cannot be reached over MCP, and who can change it. Reachability is
// the team's: its switch covers everything it owns, and a project of it is covered or
// not. Neither is set here, so the reader gets the people who run the team — with
// their addresses — or, when they run it themselves, the settings.
export default function McpAccessNotice({
  teamId,
  teamName,
  teamRole,
  teamMcpEnabled,
}: {
  teamId: number;
  teamName: string;
  teamRole: TeamRole | 'agent' | null;
  teamMcpEnabled: boolean;
}) {
  const t = useTranslations('mcp');
  const { data: team } = useTeamQuery(teamId);
  const canManage = teamRole === 'owner' || teamRole === 'manager';
  const managers = team?.leads ?? [];

  let action: ReactNode = null;
  if (canManage) {
    action = (
      <Link
        href={teamSectionPath(teamId, 'mcp')}
        className="inline-block text-sm font-medium underline underline-offset-4"
      >
        {t('openTeamSettings')}
      </Link>
    );
  } else if (!team) {
    action = <Skeleton className="h-4 w-48" />;
  } else if (managers.length > 0) {
    action = (
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{t('askManager')}</p>
        <ul className="space-y-0.5">
          {managers.map((m) => (
            <li key={m.userId} className="text-sm">
              <span className="font-medium">{m.name}</span>
              <a
                href={`mailto:${m.email}`}
                className="ms-2 text-muted-foreground underline underline-offset-4"
              >
                {m.email}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed px-4 py-3.5">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t('disabled')}</p>
        <p className="text-sm text-muted-foreground">
          {teamMcpEnabled
            ? t('offForProject', { team: teamName })
            : t('offForTeam', { team: teamName })}
        </p>
      </div>
      {action}
    </div>
  );
}
