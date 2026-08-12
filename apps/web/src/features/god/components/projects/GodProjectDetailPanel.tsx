'use client';

import { Users, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InstanceProjectDetail } from '@/lib/api';
import { formatDate, formatDateTime } from '@/utils/dates';
import { useExitOnEscape } from '@/hooks/useExitOnEscape';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePermissionCatalogQuery } from '@/services/roles.service';
import { useInstanceProjectQuery } from '../../services/god.service';
import { compactCount } from '../../utils/numbers';
import GodProjectMemberCard from './GodProjectMemberCard';

// One number from the project, with a quiet label under it. The counts read as a
// grid so the size of a project is one glance rather than a list of sentences.
function Stat({ label, value }: { label: string; value: number }) {
  const t = useTranslations('god.projectPanel');
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2.5" title={t('statTitle', { label, value })}>
      <div className="text-lg font-semibold tabular-nums">{compactCount(value)}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

// The counts of a project, in the order they matter: the work first, then what is
// configured around it.
const STATS = [
  { key: 'issues', count: (p: InstanceProjectDetail) => p.issueCount },
  { key: 'archivedIssues', count: (p: InstanceProjectDetail) => p.archivedIssueCount },
  { key: 'initiatives', count: (p: InstanceProjectDetail) => p.initiativeCount },
  { key: 'members', count: (p: InstanceProjectDetail) => p.memberCount },
  { key: 'dashboards', count: (p: InstanceProjectDetail) => p.dashboardCount },
  { key: 'views', count: (p: InstanceProjectDetail) => p.viewCount },
  { key: 'agents', count: (p: InstanceProjectDetail) => p.agentCount },
  { key: 'skills', count: (p: InstanceProjectDetail) => p.skillCount },
  { key: 'tools', count: (p: InstanceProjectDetail) => p.toolCount },
  { key: 'integrations', count: (p: InstanceProjectDetail) => p.integrationCount },
] as const;

// One project in a right-hand side panel (the same surface the user directory uses):
// what the project holds, and every member with the permissions their membership
// resolves to. Escape or a backdrop click closes it.
export default function GodProjectDetailPanel({
  projectId,
  onClose,
}: {
  projectId: number;
  onClose: () => void;
}) {
  const t = useTranslations('god.projectPanel');
  const tCommon = useTranslations('common');
  const projectQuery = useInstanceProjectQuery(projectId);
  const catalogQuery = usePermissionCatalogQuery();
  const project = projectQuery.data;

  useExitOnEscape(onClose);

  return (
    <div
      className="fixed inset-0 z-40 flex bg-black/20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ml-auto flex h-full w-full flex-col border-l bg-card sm:w-[680px] sm:max-w-[92vw]">
        <div className="flex shrink-0 items-start justify-between gap-3 bg-muted/30 px-6 pt-5 pb-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">
                {project?.key ?? '…'}
              </span>
              <h2 className="truncate text-base font-semibold">
                {project ? project.name : tCommon('loading')}
              </h2>
            </div>
            {project?.description && (
              <p className="line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
            )}
            {project && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <Badge
                  variant={project.mcpEnabled ? 'secondary' : 'outline'}
                  className="px-1.5 py-0 text-[10px] font-medium"
                >
                  {t(project.mcpEnabled ? 'mcpEnabled' : 'mcpOff')}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {t('created', { date: formatDate(project.createdAt) })}
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
          {!project ? (
            <ListSkeleton rows={5} rowClassName="h-12" />
          ) : (
            <>
              <section className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  {t('lastActivity', {
                    value: project.lastActivityAt
                      ? formatDateTime(project.lastActivityAt)
                      : t('noActivity'),
                  })}
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {STATS.map((s) => (
                    <Stat key={s.key} label={t(`stats.${s.key}`)} value={s.count(project)} />
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-medium">{t('members')}</h3>
                  {project.members.length > 0 && (
                    <span className="text-xs text-muted-foreground">{project.members.length}</span>
                  )}
                </div>
                {project.members.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/30 px-6 py-10 text-center">
                    <Users className="size-5 text-muted-foreground" />
                    <p className="text-sm font-medium">{t('noMembersTitle')}</p>
                    <p className="max-w-[36ch] text-xs text-muted-foreground">
                      {t('noMembersHint')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {project.members.map((m) => (
                      <GodProjectMemberCard key={m.userId} member={m} catalog={catalogQuery.data} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
