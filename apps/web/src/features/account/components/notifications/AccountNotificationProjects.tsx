import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type {
  NotificationPreferences,
  ProjectNotificationPreferences,
} from '@/lib/api/endpoints/notificationPreferences';
import { groupInOrder } from '@/utils/groupInOrder';
import type {
  AccountNotificationUpdate,
  PreferencesOf,
} from '../../hooks/useAccountNotificationUpdate';
import { NO_NOTIFICATIONS, type NotificationChannel } from '../../utils/notificationEvents';
import AccountNotificationEditDialog from './AccountNotificationEditDialog';
import AccountNotificationProject from './AccountNotificationProject';
import AccountNotificationProjectActions from './AccountNotificationProjectActions';
import AccountNotificationProjectPick from './AccountNotificationProjectPick';
import AccountListSection from '../shared/AccountListSection';
import AccountNotificationTeam from './AccountNotificationTeam';

export default function AccountNotificationProjects({
  projects,
  defaults,
  channels,
  channelsOf,
  onChange,
  onReplace,
}: {
  projects: ProjectNotificationPreferences[];
  defaults: NotificationPreferences;
  channels: NotificationChannel[];
  channelsOf: (project: ProjectNotificationPreferences) => NotificationChannel[];
  onChange: (projectId: number, preferences: NotificationPreferences) => void;
  onReplace: AccountNotificationUpdate['replace'];
}) {
  const t = useTranslations('account.notifications');
  // Null while projects are not being selected.
  const [picked, setPicked] = useState<number[] | null>(null);
  const [editing, setEditing] = useState(false);
  const selected = projects.filter((p) => picked?.includes(p.id));
  const count = selected.length;

  function pick(ids: number[], on: boolean) {
    setPicked((current) => {
      const others = (current ?? []).filter((id) => !ids.includes(id));
      return on ? [...others, ...ids] : others;
    });
  }

  // A failed write keeps the selection for another try.
  async function replaceSelected(preferencesOf: PreferencesOf, message: string) {
    if (!(await onReplace(selected, preferencesOf, message))) return;
    setPicked(null);
    setEditing(false);
  }

  return (
    <AccountListSection
      title={count > 0 ? t('selected', { count }) : t('projects')}
      sticky={picked !== null}
      actions={
        projects.length > 1 && (
          <AccountNotificationProjectActions
            selecting={picked !== null}
            anySelected={count > 0}
            onSelect={() => setPicked([])}
            onEdit={() => setEditing(true)}
            onUseDefaults={() =>
              void replaceSelected(() => null, t('projectsUseDefaults', { count }))
            }
            onTurnOff={() =>
              void replaceSelected(() => NO_NOTIFICATIONS, t('turnedOff', { count }))
            }
            onCancel={() => setPicked(null)}
          />
        )
      }
    >
      {projects.length === 0 && <p className="text-sm text-muted-foreground">{t('noProjects')}</p>}
      {groupInOrder(projects, (project) => project.team.id).map(([teamId, ofTeam]) => (
        <AccountNotificationTeam
          key={teamId}
          name={ofTeam[0]!.team.name}
          count={ofTeam.length}
          picked={picked && ofTeam.filter((p) => picked.includes(p.id)).length}
          onPick={(on) =>
            pick(
              ofTeam.map((p) => p.id),
              on,
            )
          }
        >
          {ofTeam.map((project) =>
            picked ? (
              <AccountNotificationProjectPick
                key={project.id}
                name={project.name}
                checked={picked.includes(project.id)}
                onChange={(on) => pick([project.id], on)}
              />
            ) : (
              <AccountNotificationProject
                key={project.id}
                project={project}
                defaults={defaults}
                channels={channelsOf(project)}
                onChange={(preferences) => onChange(project.id, preferences)}
                onUseDefaults={() =>
                  void onReplace(
                    [project],
                    () => null,
                    t('projectUsesDefaults', { project: project.name }),
                  )
                }
              />
            ),
          )}
        </AccountNotificationTeam>
      ))}
      {editing && (
        <AccountNotificationEditDialog
          projects={selected}
          defaults={defaults}
          channels={channels.filter((channel) =>
            selected.some((p) => channelsOf(p).includes(channel)),
          )}
          onSave={(preferencesOf) => replaceSelected(preferencesOf, t('projectsSaved', { count }))}
          onClose={() => setEditing(false)}
        />
      )}
    </AccountListSection>
  );
}
