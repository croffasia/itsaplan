'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InstanceTeam } from '@/lib/api/endpoints/god';
import { formatDate } from '@/utils/dates';
import { useExitOnEscape } from '@/hooks/useExitOnEscape';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useInstanceTeamQuery } from '../../services/god.service';
import { compactCount } from '../../utils/numbers';
import GodTeamMembers from './GodTeamMembers';
import GodTeamProjects from './GodTeamProjects';

// One number from the team, with a quiet label under it. The counts read as a grid so
// the size of a team is one glance rather than a list of sentences.
function Stat({ label, value }: { label: string; value: number }) {
  const t = useTranslations('god.teamPanel');
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2.5" title={t('statTitle', { label, value })}>
      <div className="text-lg font-semibold tabular-nums">{compactCount(value)}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

// The counts of a team, in the order they matter: the work first, then what is
// configured around it.
const STATS = [
  { key: 'projects', count: (team: InstanceTeam) => team.projectCount },
  { key: 'issues', count: (team: InstanceTeam) => team.issueCount },
  { key: 'members', count: (team: InstanceTeam) => team.memberCount },
  { key: 'agents', count: (team: InstanceTeam) => team.agentCount },
  { key: 'skills', count: (team: InstanceTeam) => team.skillCount },
  { key: 'tools', count: (team: InstanceTeam) => team.toolCount },
  { key: 'roles', count: (team: InstanceTeam) => team.roleCount },
] as const;

// One team in a right-hand side panel (the same surface the user and project
// directories use): what the team holds, the projects it owns and everyone in it,
// each list searched and paged on its own. Escape or a backdrop click closes it.
export default function GodTeamDetailPanel({
  teamId,
  onClose,
}: {
  teamId: number;
  onClose: () => void;
}) {
  const t = useTranslations('god.teamPanel');
  const tCommon = useTranslations('common');
  const teamQuery = useInstanceTeamQuery(teamId);
  const team = teamQuery.data;

  useExitOnEscape(onClose);

  return (
    <div
      className="fixed inset-0 z-40 flex bg-black/20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ml-auto flex h-full w-full flex-col border-l bg-card sm:w-[680px] sm:max-w-[92vw]">
        <div className="flex shrink-0 items-start justify-between gap-3 bg-muted/30 px-6 pt-5 pb-4">
          <div className="min-w-0 space-y-1.5">
            <h2 className="truncate text-base font-semibold">
              {team ? team.name : tCommon('loading')}
            </h2>
            {team && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant={team.mcpEnabled ? 'secondary' : 'outline'}
                  className="px-1.5 py-0 text-[10px] font-medium"
                >
                  {t(team.mcpEnabled ? 'mcpEnabled' : 'mcpOff')}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {t('created', { date: formatDate(team.createdAt) })}
                </span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
            title={tCommon('close')}
          >
            <X />
          </Button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          {!team ? (
            <ListSkeleton rows={5} rowClassName="h-12" />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {STATS.map((s) => (
                  <Stat key={s.key} label={t(`stats.${s.key}`)} value={s.count(team)} />
                ))}
              </div>

              <GodTeamProjects teamId={teamId} />
              <GodTeamMembers teamId={teamId} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
