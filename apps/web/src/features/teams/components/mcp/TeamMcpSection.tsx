'use client';

import { useTranslations } from 'next-intl';
import { Check, Minus } from 'lucide-react';
import { useTeam, useTeamProjectOptionsQuery, useUpdateTeamMcp } from '@/services/teams.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Switch } from '@/components/ui/switch';
import McpConnectionGuide from '@/features/mcp/components/McpConnectionGuide';

function McpStatus({ on }: { on: boolean }) {
  const t = useTranslations('teams.mcp');
  return (
    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {on ? <Check className="size-4 text-green-500" /> : <Minus className="size-4" />}
      {t(on ? 'statusOn' : 'statusOff')}
    </span>
  );
}

// The team's MCP settings: the switch that opens the team to MCP clients at all, and
// which of its projects that reach covers. Owners and managers set both; a plain
// member reads them. A project does not open itself — its own MCP page only reports
// the state and who to ask.
export default function TeamMcpSection({ teamId }: { teamId: number }) {
  const t = useTranslations('teams.mcp');
  const team = useTeam(teamId);
  const { data: projects } = useTeamProjectOptionsQuery(teamId);
  const update = useUpdateTeamMcp(teamId);

  const canManage = team != null && team.role !== 'member';
  const enabled = team?.mcpEnabled ?? false;
  const busy = update.isPending;

  return (
    <SectionPageView title={t('title')} description={t('description')}>
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-6 rounded-lg bg-muted/40 px-4 py-3.5">
          <div className="space-y-0.5">
            <span className="text-sm font-medium">{t('access')}</span>
            <p className="text-sm text-muted-foreground">
              {canManage ? t('accessHint') : t('managerOnly')}
            </p>
          </div>
          {canManage ? (
            <Switch
              checked={enabled}
              disabled={busy}
              onCheckedChange={(value) => update.mutate({ enabled: value })}
              aria-label={t('toggleAria')}
            />
          ) : (
            <McpStatus on={enabled} />
          )}
        </div>

        {enabled && (
          <>
            <section className="space-y-3">
              <div className="border-b pb-1">
                <span className="text-xs font-medium text-muted-foreground">{t('projects')}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t('projectsHint')}</p>

              {!projects ? (
                <ListSkeleton rows={3} rowClassName="h-11" />
              ) : projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noProjects')}</p>
              ) : (
                <ul className="space-y-1">
                  {projects.map((project) => (
                    <li
                      key={project.id}
                      className="flex items-center justify-between gap-4 rounded-md px-3 py-2 hover:bg-accent/50"
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{project.name}</span>
                        <span className="ms-2 font-mono text-xs text-muted-foreground">
                          {project.key}
                        </span>
                      </div>
                      {canManage ? (
                        <Switch
                          checked={project.mcpEnabled}
                          disabled={busy}
                          onCheckedChange={(value) =>
                            update.mutate({ projects: [{ projectId: project.id, enabled: value }] })
                          }
                          aria-label={t('projectToggleAria', { project: project.name })}
                        />
                      ) : (
                        <McpStatus on={project.mcpEnabled} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <McpConnectionGuide />
          </>
        )}
      </div>
    </SectionPageView>
  );
}
