import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useImportSources } from '@/cloud';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { usePermissions } from '@/hooks/usePermissions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import SettingsSection from '@/components/common/page/SettingsSection';
import type { ImportSourceEntry } from '../../types/importSource';
import SettingsImportExportPlane from './SettingsImportExportPlane';
import SettingsImportExportLinear from './SettingsImportExportLinear';
import SettingsImportExportTrello from './SettingsImportExportTrello';
import SettingsImportExportMoreSources from './SettingsImportExportMoreSources';
import SettingsImportExportJobList from './SettingsImportExportJobList';
import SettingsImportExportDownloadButton from './SettingsImportExportDownloadButton';

const CORE_SOURCES: ImportSourceEntry[] = [
  { kind: 'source', key: 'plane', label: 'Plane', Component: SettingsImportExportPlane },
  { kind: 'source', key: 'linear', label: 'Linear', Component: SettingsImportExportLinear },
  { kind: 'source', key: 'trello', label: 'Trello', Component: SettingsImportExportTrello },
];

// Import and export on two tabs. Import: pick a source, connect to it, pick what to
// import, and watch the jobs already started. A member who cannot start an import
// (import_export: create) still sees the job list, since reading it needs only
// import_export: read, which the page itself already requires; the export tab needs
// create too.
export default function SettingsImportExport({ project }: { project: ProjectDetail }) {
  const t = useTranslations('settings.importExport');
  const projectKey = project.project.ref;
  const { can } = usePermissions();
  const canCreate = can('import_export', 'create');
  const canEdit = can('import_export', 'edit');
  const entries = useImportSources(CORE_SOURCES);
  const [sourceKey, setSourceKey] = useState(CORE_SOURCES[0]!.key);
  const source = entries.find((e) => e.kind === 'source' && e.key === sourceKey);

  return (
    <Tabs defaultValue="import">
      <TabsList variant="line">
        <TabsTrigger value="import">{t('import')}</TabsTrigger>
        {canCreate && <TabsTrigger value="export">{t('export')}</TabsTrigger>}
      </TabsList>
      <TabsContent value="import" className="mt-4 space-y-10">
        {canCreate && (
          <>
            <SettingsSection title={t('source')} description={t('sourceHint')}>
              <Tabs value={sourceKey} onValueChange={setSourceKey}>
                <TabsList variant="line">
                  {entries.map((entry) =>
                    entry.kind === 'more' ? (
                      <SettingsImportExportMoreSources
                        key={entry.key}
                        label={entry.label}
                        hint={entry.hint}
                      />
                    ) : (
                      <TabsTrigger key={entry.key} value={entry.key}>
                        {entry.label}
                      </TabsTrigger>
                    ),
                  )}
                </TabsList>
              </Tabs>
            </SettingsSection>
            {source?.kind === 'source' && <source.Component key={source.key} project={project} />}
          </>
        )}
        <SettingsSection title={t('jobs')} description={t('jobsHint')}>
          <SettingsImportExportJobList projectKey={projectKey} editable={canEdit} />
        </SettingsSection>
      </TabsContent>
      {canCreate && (
        <TabsContent value="export" className="mt-4">
          <SettingsSection title={t('export')} description={t('exportHint')}>
            <SettingsImportExportDownloadButton projectKey={projectKey} />
          </SettingsSection>
        </TabsContent>
      )}
    </Tabs>
  );
}
