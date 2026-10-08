import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type {
  ImportSource,
  PlaneConnectionInput,
  PlaneProjectOption,
} from '@/lib/api/endpoints/importExport';
import { usePermissions } from '@/hooks/usePermissions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsImportExportConnectForm from './SettingsImportExportConnectForm';
import SettingsImportExportProjectPicker from './SettingsImportExportProjectPicker';
import SettingsImportExportMappingReview from './SettingsImportExportMappingReview';
import SettingsImportExportJobList from './SettingsImportExportJobList';
import SettingsImportExportDownloadButton from './SettingsImportExportDownloadButton';
import SettingsImportExportLinear from './SettingsImportExportLinear';

export interface PlaneConnection extends PlaneConnectionInput {
  projects: PlaneProjectOption[];
}

// Plane and Linear import today; the rest are listed disabled.
const SOURCES = [
  { key: 'plane', label: 'Plane', available: true },
  { key: 'linear', label: 'Linear', available: true },
  { key: 'jira', label: 'Jira', available: false },
  { key: 'trello', label: 'Trello', available: false },
] as const;

// Import and export on two tabs. Import: pick a source, connect to it, pick a
// project to import from, and watch the jobs already started. A member who
// cannot start an import (import_export: create) still sees the job list, since
// reading it needs only import_export: read, which the page itself already
// requires; the export tab needs create too.
export default function SettingsImportExport({ project }: { project: ProjectDetail }) {
  const t = useTranslations('settings.importExport');
  const projectKey = project.project.ref;
  const { can } = usePermissions();
  const canCreate = can('import_export', 'create');
  const canEdit = can('import_export', 'edit');
  const [source, setSource] = useState<ImportSource>('plane');
  const [connection, setConnection] = useState<PlaneConnection | null>(null);
  const [selected, setSelected] = useState<PlaneProjectOption | null>(null);

  function onTested(next: PlaneConnection) {
    setConnection(next);
    setSelected(null);
  }

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
              <Tabs value={source} onValueChange={(value) => setSource(value as ImportSource)}>
                <TabsList variant="line">
                  {SOURCES.map((option) => (
                    <TabsTrigger key={option.key} value={option.key} disabled={!option.available}>
                      {option.label}
                      {!option.available && (
                        <span className="text-[10px] font-normal tracking-wide uppercase">
                          {t('comingSoon')}
                        </span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </SettingsSection>
            {source === 'plane' && (
              <>
                <SettingsSection title={t('connect')} description={t('connectHint')}>
                  <SettingsCard className="p-4">
                    <SettingsImportExportConnectForm projectKey={projectKey} onTested={onTested} />
                  </SettingsCard>
                </SettingsSection>
                {connection && (
                  <SettingsSection title={t('sourceProject')} description={t('sourceProjectHint')}>
                    <SettingsCard className="space-y-6 p-4">
                      <SettingsImportExportProjectPicker
                        key={connection.baseUrl + connection.workspaceSlug}
                        connection={connection}
                        selected={selected}
                        onSelect={setSelected}
                      />
                      {selected && (
                        <SettingsImportExportMappingReview
                          projectKey={projectKey}
                          target={{ source: 'plane', connection, project: selected }}
                          onImported={() => setSelected(null)}
                        />
                      )}
                    </SettingsCard>
                  </SettingsSection>
                )}
              </>
            )}
            {source === 'linear' && <SettingsImportExportLinear projectKey={projectKey} />}
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
