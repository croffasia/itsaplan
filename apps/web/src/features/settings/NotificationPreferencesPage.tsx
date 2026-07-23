'use client';

import type { ReactNode } from 'react';
import type { NotificationPreferences as Prefs } from '@/lib/api';
import { useShell } from '@/context/shellContext';
import { Button } from '@/components/ui/button';
import SectionPageView from '@/components/common/page/SectionPageView';
import NotificationPreferences from './components/notifications/NotificationPreferences';
import { useNotificationPreferencesQuery } from './services/settings.service';
import { useNotificationPreferencesForm } from './hooks/useNotificationPreferencesForm';

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
  return (
    <SectionPageView
      title="Notifications"
      description="Choose which issue events you get and where. Email goes to your account address; Telegram to the chat id you set below."
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
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Chrome>
    );
  }
  return <PreferencesLoaded projectKey={projectKey} initial={query.data} />;
}

function PreferencesLoaded({ projectKey, initial }: { projectKey: string; initial: Prefs }) {
  const form = useNotificationPreferencesForm(projectKey, initial);
  return (
    <Chrome
      actions={
        <Button size="sm" onClick={() => void form.save()} disabled={!form.dirty || form.saving}>
          Save
        </Button>
      }
    >
      <NotificationPreferences form={form} />
    </Chrome>
  );
}
