'use client';

import { ClipboardList } from 'lucide-react';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { usePermissions } from '@/hooks/usePermissions';
import type { SettingsSection } from '@/utils/settingsSections';
import SettingsFormsPreview from '@/features/settings/components/forms/SettingsFormsPreview';

// A self-hosted instance lists the core's project settings sections with a preview of the
// forms the hosted build and Pro add after the webhooks, to the people who govern the
// project's settings, as those builds do. The hosted build returns the core's with its own
// added at any position, in a group of the core's or one of its own, or with one left out.
// `project` is null until the Shell has loaded it.
export default function useProjectSettingsSections(
  project: ProjectDetail | null,
  core: SettingsSection[],
): SettingsSection[] {
  const { isAdmin } = usePermissions(project);
  if (!isAdmin) return core;
  const afterWebhooks = core.findIndex((section) => section.slug === 'webhooks') + 1;
  return [
    ...core.slice(0, afterWebhooks),
    {
      slug: 'forms',
      icon: ClipboardList,
      resource: 'work_items',
      group: 'automation',
      Component: SettingsFormsPreview,
    },
    ...core.slice(afterWebhooks),
  ];
}
