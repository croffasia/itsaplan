'use client';

import { useState, type ReactNode } from 'react';
import type { NotificationSettings, ProjectDetail } from '@/lib/api';
import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import SettingsNotifications, {
  type NotificationTab,
} from './components/notifications/SettingsNotifications';
import { useNotificationSettingsQuery } from './services/settings.service';
import { useEmailForm } from './hooks/useEmailForm';
import { useTelegramForm } from './hooks/useTelegramForm';

const section = settingsSection('notifications');

// The Notification providers settings page
// (/project/:projectKey/settings/notifications). Admin-only (danger_zone): the email
// and Telegram credentials the project delivers through. Members set their own
// delivery preferences on the main-nav Notifications page. Save lives in the page
// header and acts on the active tab.
export default function SettingsNotificationsPage() {
  const { project } = useShell();
  if (!project) return null;
  return <NotificationsPage project={project} />;
}

function Chrome({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  return (
    <SectionPageView
      title={section.label}
      description={section.description}
      wide
      widthClassName="min-w-[600px] max-w-[60%]"
      actions={actions}
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          {children}
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}

function NotificationsPage({ project }: { project: ProjectDetail }) {
  const query = useNotificationSettingsQuery(project.project.key);
  if (!query.data) {
    return (
      <Chrome>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Chrome>
    );
  }
  return <NotificationsLoaded projectKey={project.project.key} settings={query.data} />;
}

function NotificationsLoaded({
  projectKey,
  settings,
}: {
  projectKey: string;
  settings: NotificationSettings;
}) {
  const { can } = usePermissions();
  const editable = can(section.resource, 'edit');
  const [tab, setTab] = useState<NotificationTab>('email');
  const emailForm = useEmailForm(projectKey, settings, editable);
  const telegramForm = useTelegramForm(projectKey, settings, editable);
  const active = tab === 'email' ? emailForm : telegramForm;

  return (
    <Chrome
      actions={
        editable ? (
          <Button
            size="sm"
            onClick={() => void active.save()}
            disabled={!active.dirty || active.saving}
          >
            Save
          </Button>
        ) : undefined
      }
    >
      <SettingsNotifications
        tab={tab}
        onTabChange={setTab}
        emailForm={emailForm}
        telegramForm={telegramForm}
      />
    </Chrome>
  );
}
