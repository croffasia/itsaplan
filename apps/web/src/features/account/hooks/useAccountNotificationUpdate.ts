'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type {
  NotificationPreferences,
  ProjectNotificationPreferences,
} from '@/lib/api/endpoints/notificationPreferences';
import { useUpdateNotificationPreferences } from '../services/notificationPreferences.service';

export type PreferencesOf = (
  project: ProjectNotificationPreferences,
) => NotificationPreferences | null;

// The page header reports every write. Replacing the settings of projects also offers Undo;
// applying the defaults to all of them is confirmed beforehand instead.
export function useAccountNotificationUpdate() {
  const t = useTranslations('account.notifications');
  const update = useUpdateNotificationPreferences();

  // Resolves to whether it was saved.
  async function replace(
    projects: ProjectNotificationPreferences[],
    preferencesOf: PreferencesOf,
    message: string,
  ): Promise<boolean> {
    try {
      await update.mutateAsync({
        projects: projects.map((p) => ({ projectId: p.id, preferences: preferencesOf(p) })),
      });
    } catch {
      // Toasted by the global mutation handler.
      return false;
    }
    const before = projects.map((p) => ({ projectId: p.id, preferences: p.preferences }));
    toast.success(message, {
      action: { label: t('undo'), onClick: () => update.mutate({ projects: before }) },
      actionButtonStyle: { background: 'transparent', color: 'inherit' },
    });
    return true;
  }

  async function applyToAll() {
    await update.mutateAsync({ resetProjects: true });
    toast.success(t('appliedToAll'));
  }

  return { update, replace, applyToAll };
}

export type AccountNotificationUpdate = ReturnType<typeof useAccountNotificationUpdate>;
