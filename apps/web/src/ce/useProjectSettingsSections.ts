'use client';

import { ClipboardList, Workflow } from 'lucide-react';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { usePermissions } from '@/hooks/usePermissions';
import type { SettingsSection } from '@/utils/settingsSections';
import SettingsFormsPreview from '@/features/settings/components/forms/SettingsFormsPreview';
import SettingsWorkflowsPreview from '@/features/settings/components/workflows/SettingsWorkflowsPreview';

// A self-hosted instance lists the core's project settings sections with previews of the
// sections the hosted build and Pro add: the agent workflows after the schedules, to those
// who read the schedules, and the forms after the webhooks, to the people who govern the
// project's settings, as those builds do. The hosted build returns the core's with its own
// added at any position, in a group of the core's or one of its own, or with one left out.
// `project` is null until the Shell has loaded it.
export default function useProjectSettingsSections(
  project: ProjectDetail | null,
  core: SettingsSection[],
): SettingsSection[] {
  const { isAdmin } = usePermissions(project);
  const sections = insertAfter(core, 'schedules', {
    slug: 'workflows',
    icon: Workflow,
    resource: 'agent_schedules',
    group: 'ai-team',
    Component: SettingsWorkflowsPreview,
  });
  if (!isAdmin) return sections;
  return insertAfter(sections, 'webhooks', {
    slug: 'forms',
    icon: ClipboardList,
    resource: 'work_items',
    group: 'automation',
    Component: SettingsFormsPreview,
  });
}

function insertAfter(sections: SettingsSection[], slug: string, section: SettingsSection) {
  const at = sections.findIndex((one) => one.slug === slug) + 1;
  return [...sections.slice(0, at), section, ...sections.slice(at)];
}
