'use client';

import { useTranslations } from 'next-intl';
import type { TeamsMigrationReport } from '@/lib/api/endpoints/updates';
import WhatsNewRenameGroup from './WhatsNewRenameGroup';

// What the move to teams did to this instance's data: which projects landed in which
// team, what was renamed to keep names unique inside a team, and what was merged.
export default function WhatsNewMigrationReport({ report }: { report: TeamsMigrationReport }) {
  const t = useTranslations('whatsNew');
  const renamed = report.renamed;
  const hasMerged =
    report.merged.roles > 0 || report.merged.agentTools > 0 || report.movedInvites > 0;

  return (
    <div className="space-y-10">
      <div>
        <h3 className="mb-3 text-sm font-medium">{t('report.teamsHeading')}</h3>
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          {report.teams.map((team) => (
            <div key={team.name} className="rounded-lg bg-muted/40 px-4 py-3">
              <p className="truncate text-sm font-medium">{team.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {team.projects.map((p) => p.name).join(', ')}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
        <WhatsNewRenameGroup title={t('report.renamedRoles')} items={renamed.roles ?? []} />
        <WhatsNewRenameGroup title={t('report.renamedSkills')} items={renamed.skills ?? []} />
        <WhatsNewRenameGroup title={t('report.renamedAgents')} items={renamed.agents ?? []} />
        <WhatsNewRenameGroup
          title={t('report.renamedCredentials')}
          items={renamed.credentials ?? []}
        />
      </div>

      {(hasMerged || report.droppedNotificationSettings.length > 0) && (
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          {hasMerged && (
            <div>
              <h3 className="mb-2 text-sm font-medium">{t('report.mergedHeading')}</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {report.merged.roles > 0 && (
                  <li>{t('report.mergedRoles', { count: report.merged.roles })}</li>
                )}
                {report.merged.agentTools > 0 && (
                  <li>{t('report.mergedTools', { count: report.merged.agentTools })}</li>
                )}
                {report.movedInvites > 0 && (
                  <li>{t('report.movedInvites', { count: report.movedInvites })}</li>
                )}
              </ul>
            </div>
          )}

          {report.droppedNotificationSettings.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">{t('report.notificationsHeading')}</h3>
              <p className="max-w-[68ch] text-sm text-muted-foreground">
                {t('report.notificationsBody', {
                  projects: report.droppedNotificationSettings.join(', '),
                })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
