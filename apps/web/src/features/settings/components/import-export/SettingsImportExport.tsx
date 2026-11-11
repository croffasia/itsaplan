import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { useImportSources } from '@/cloud';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { usePermissions } from '@/hooks/usePermissions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import SettingsSection from '@/components/common/page/SettingsSection';
import type { ImportSourceEntry } from '../../types/importSource';
import SettingsImportExportPlane from './SettingsImportExportPlane';
import SettingsImportExportLinear from './SettingsImportExportLinear';
import SettingsImportExportTrello from './SettingsImportExportTrello';
import SettingsImportExportJobList from './SettingsImportExportJobList';
import SettingsImportExportDownloadButton from './SettingsImportExportDownloadButton';
import SettingsImportExportPlaneLogo from './SettingsImportExportPlaneLogo';
import SettingsImportExportLinearLogo from './SettingsImportExportLinearLogo';
import SettingsImportExportTrelloLogo from './SettingsImportExportTrelloLogo';

const CORE_SOURCES: ImportSourceEntry[] = [
  {
    kind: 'source',
    key: 'plane',
    label: 'Plane',
    Logo: SettingsImportExportPlaneLogo,
    Component: SettingsImportExportPlane,
  },
  {
    kind: 'source',
    key: 'linear',
    label: 'Linear',
    Logo: SettingsImportExportLinearLogo,
    Component: SettingsImportExportLinear,
  },
  {
    kind: 'source',
    key: 'trello',
    label: 'Trello',
    Logo: SettingsImportExportTrelloLogo,
    Component: SettingsImportExportTrello,
  },
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
  const source = entries.find((e) => e.key === sourceKey);

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
                  {entries.map((entry) => (
                    <TabsTrigger key={entry.key} value={entry.key}>
                      {entry.kind === 'locked' && <Lock aria-hidden />}
                      {entry.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </SettingsSection>
            {source?.kind === 'source' && <source.Component key={source.key} project={project} />}
            {source?.kind === 'locked' && <source.Component key={source.key} />}
          </>
        )}
        <SettingsSection title={t('jobs')} description={t('jobsHint')}>
          <SettingsImportExportJobList
            projectKey={projectKey}
            editable={canEdit}
            sources={entries}
          />
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
