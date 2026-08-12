'use client';

import type { ReactNode } from 'react';
import type { NotificationPreferences as Prefs } from '@/lib/api';
import { useShell } from '@/context/shellContext';
import { Button } from '@/components/ui/button';
import SectionPageView from '@/components/common/page/SectionPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import NotificationPreferences from './components/notifications/NotificationPreferences';
import { useNotificationPreferencesQuery } from './services/settings.service';
import { useNotificationPreferencesForm } from './hooks/useNotificationPreferencesForm';
import { useTranslations } from 'next-intl';

// The member's own notification preferences (/project/:projectKey/notifications).
// A main-nav Configuration destination, open to any member: choose which issue events
// you get and where (email, Telegram), plus your Telegram chat id. The delivery
// providers are configured separately by admins (settings -> Notification providers).
export default function NotificationPreferencesPage() {
  const { project } = useShell();
  if (!project) return null;
  return <PreferencesPage projectKey={project.project.key} />;
}

function Chrome({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  const t = useTranslations('settings.notifications');
  return (
    <SectionPageView
      title={t('title')}
      description={t('description')}
      wide
      widthClassName="min-w-[600px] max-w-[60%]"
      actions={actions}
    >
      {children}
    </SectionPageView>
  );
}

function PreferencesPage({ projectKey }: { projectKey: string }) {
  const query = useNotificationPreferencesQuery(projectKey);
  if (!query.data) {
    return (
      <Chrome>
        <ListSkeleton rows={5} rowClassName="h-12" />
      </Chrome>
    );
  }
  return <PreferencesLoaded projectKey={projectKey} initial={query.data} />;
}

function PreferencesLoaded({ projectKey, initial }: { projectKey: string; initial: Prefs }) {
  const t = useTranslations('common');
  const form = useNotificationPreferencesForm(projectKey, initial);
  return (
    <Chrome
      actions={
        <Button size="sm" onClick={() => void form.save()} disabled={!form.dirty || form.saving}>
          {t('save')}
        </Button>
      }
    >
      <NotificationPreferences form={form} />
    </Chrome>
  );
}
