'use client';

import { useShell } from '@/context/shellContext';
import SectionPageView from '@/components/common/page/SectionPageView';
import NotificationPreferences from './components/notifications/NotificationPreferences';

// The member's own notification preferences (/project/:projectKey/notifications).
// A main-nav Configuration destination, open to any member: choose which issue events
// you get and where (email, Telegram), plus your Telegram chat id. The delivery
// providers are configured separately by admins (settings -> Notification providers).
export default function NotificationPreferencesPage() {
  const { project } = useShell();
  if (!project) return null;
  return (
    <SectionPageView
      title="Notifications"
      description="Choose which issue events you get and where. Email goes to your account address; Telegram to the chat id you set below."
    >
      <NotificationPreferences projectKey={project.project.key} />
    </SectionPageView>
  );
}
