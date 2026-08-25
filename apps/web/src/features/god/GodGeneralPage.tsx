'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Switch } from '@/components/ui/switch';
import GodSectionPage from './components/GodSectionPage';
import GodSettingsGate from './components/GodSettingsGate';
import {
  useInstanceProjectDefaultsQuery,
  useUpdateInstanceProjectDefaults,
} from './services/god.service';
import type { ProjectDefaults } from '@/lib/api';

// General: the instance-wide defaults that decide what a new project starts with.
// Each one stays editable per project afterwards, and projects that already exist
// are untouched by a change here.
export default function GodGeneralPage() {
  const query = useInstanceProjectDefaultsQuery();

  return (
    <GodSettingsGate slug="general" data={query.data}>
      {(defaults) => <GeneralForm defaults={defaults} />}
    </GodSettingsGate>
  );
}

function GeneralForm({ defaults }: { defaults: ProjectDefaults }) {
  const t = useTranslations('god.general');
  const update = useUpdateInstanceProjectDefaults();

  // A single toggle, so it saves on change rather than behind a Save button.
  async function setMcpEnabled(mcpEnabled: boolean) {
    try {
      await update.mutateAsync({ ...defaults, mcpEnabled });
      toast.success(t('saved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <GodSectionPage slug="general">
      <div className="space-y-8">
        <SettingsSection title={t('projectDefaults')} description={t('projectDefaultsHint')}>
          <SettingsCard className="divide-y divide-border/60">
            <SettingsRow
              title={t('mcpEnabled')}
              description={t('mcpEnabledHint')}
              control={
                <Switch
                  checked={defaults.mcpEnabled}
                  disabled={update.isPending}
                  onCheckedChange={(checked) => void setMcpEnabled(checked)}
                />
              }
            />
          </SettingsCard>
        </SettingsSection>
      </div>
    </GodSectionPage>
  );
}
