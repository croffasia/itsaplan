'use client';

import type { ImportSourceEntry } from '@/features/settings/types/importSource';
import SettingsImportExportAsanaPreview from '@/features/settings/components/import-export/SettingsImportExportAsanaPreview';
import SettingsImportExportJiraPreview from '@/features/settings/components/import-export/SettingsImportExportJiraPreview';

// A self-hosted instance imports from the core's sources, and the locked Jira and Asana tabs
// say what the editions with those imports bring. The hosted build returns the core's with its
// own added at any position.
export default function useImportSources(core: ImportSourceEntry[]): ImportSourceEntry[] {
  return [
    ...core,
    { kind: 'locked', key: 'jira', label: 'Jira', Component: SettingsImportExportJiraPreview },
    { kind: 'locked', key: 'asana', label: 'Asana', Component: SettingsImportExportAsanaPreview },
  ];
}
