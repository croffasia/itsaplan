'use client';

import { useTranslations } from 'next-intl';
import FullPageView from '@/components/common/page/FullPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { useUpdateAccountPreferences } from '@/services/preferences.service';
import AccountSaveState from './components/AccountSaveState';
import AccountNotificationAutoWatch from './components/notifications/AccountNotificationAutoWatch';
import AccountNotificationChannels from './components/notifications/AccountNotificationChannels';
import AccountNotificationDefaults from './components/notifications/AccountNotificationDefaults';
import AccountNotificationProjects from './components/notifications/AccountNotificationProjects';
import { useAccountNotificationChannels } from './hooks/useAccountNotificationChannels';
import { useAccountNotificationUpdate } from './hooks/useAccountNotificationUpdate';
import { useNotificationPreferencesQuery } from './services/notificationPreferences.service';

// Everything about the user's notifications (/account/notifications).
export default function AccountNotificationsPage() {
  const t = useTranslations('account.notifications');
  const { data } = useNotificationPreferencesQuery();
  const { pending, channels, channelsOf } = useAccountNotificationChannels();
  const { update, replace, applyToAll } = useAccountNotificationUpdate();
  const updateAccount = useUpdateAccountPreferences();
  const last = updateAccount.submittedAt > update.submittedAt ? updateAccount : update;

  return (
    <FullPageView
      label={t('label')}
      title={t('title')}
      description={t('description')}
      actions={
        <AccountSaveState
          saving={update.isPending || updateAccount.isPending}
          saved={last.isSuccess ? t('saved') : undefined}
        />
      }
    >
      {!data || pending ? (
        <ListSkeleton rows={5} rowClassName="h-12" />
      ) : (
        <>
          <AccountNotificationDefaults
            defaults={data.defaults}
            channels={channels}
            ownCount={data.projects.filter((p) => p.preferences).length}
            onChange={(defaults) => update.mutate({ defaults })}
            onApplyToAll={applyToAll}
          />
          <AccountNotificationChannels />
          <AccountNotificationAutoWatch
            onChange={(autoWatch) => updateAccount.mutate({ autoWatch })}
          />
          <AccountNotificationProjects
            projects={data.projects}
            defaults={data.defaults}
            channels={channels}
            channelsOf={channelsOf}
            onChange={(projectId, preferences) =>
              update.mutate({ projects: [{ projectId, preferences }] })
            }
            onReplace={replace}
          />
        </>
      )}
    </FullPageView>
  );
}
