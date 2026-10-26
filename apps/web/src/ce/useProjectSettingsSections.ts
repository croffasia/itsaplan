'use client';

import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { SettingsSection } from '@/utils/settingsSections';

// A self-hosted instance lists the core's project settings sections. The hosted build
// returns them with its own added at any position, in a group of the core's or one of
// its own, or with one left out. `project` is null until the Shell has loaded it.
export default function useProjectSettingsSections(
  _project: ProjectDetail | null,
  core: SettingsSection[],
): SettingsSection[] {
  return core;
}
