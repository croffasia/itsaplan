'use client';

import type { ImportSourceEntry } from '@/features/settings/types/importSource';
import SettingsImportExportJiraPreview from '@/features/settings/components/import-export/SettingsImportExportJiraPreview';

// A self-hosted instance imports from the core's sources, and a locked Jira tab says what
// the editions with the Jira import bring. The hosted build returns the core's with its
// own added at any position.
export default function useImportSources(core: ImportSourceEntry[]): ImportSourceEntry[] {
  return [
    ...core,
    { kind: 'locked', key: 'jira', label: 'Jira', Component: SettingsImportExportJiraPreview },
  ];
}
