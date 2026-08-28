'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { InstanceScimSettings } from '@/lib/api';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsCard from '@/components/common/page/SettingsCard';
import CopyableValue from '@/components/common/page/CopyableValue';
import EnabledSwitch from '@/components/common/inputs/EnabledSwitch';
import { Button } from '@/components/ui/button';
import GodScimTokenDialog from './GodScimTokenDialog';
import GodScimGroupList from './GodScimGroupList';
import { useUpdateInstanceScimSettings } from '../../services/god.service';

// The endpoint and the token go into the identity provider; the groups it then
// pushes appear below, where the owner says what each one grants.
export default function GodScimSettings({ settings }: { settings: InstanceScimSettings }) {
  const t = useTranslations('god.scim');
  const update = useUpdateInstanceScimSettings();
  const [generating, setGenerating] = useState(false);

  async function toggle(enabled: boolean) {
    try {
      await update.mutateAsync({ enabled });
      toast.success(t('saved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <div className="space-y-10">
      <SettingsSection
        title={t('provisioning')}
        description={t(settings.hasToken ? 'provisioningConfigured' : 'provisioningMissing')}
        action={
          <EnabledSwitch
            checked={settings.enabled}
            onChange={(v) => void toggle(v)}
            disabled={update.isPending || !settings.hasToken}
          />
        }
      >
        <SettingsCard className="space-y-6 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <div className="text-sm font-medium">{t('token')}</div>
              <p className="font-mono text-xs">
                {settings.hasToken ? `${settings.tokenPrefix}…` : t('noToken')}
              </p>
              <p className="text-xs text-muted-foreground">{t('tokenHint')}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setGenerating(true)}
            >
              {settings.hasToken ? t('replaceToken') : t('generateToken')}
            </Button>
          </div>

          <CopyableValue
            title={t('baseUrl')}
            value={settings.baseUrl}
            hint={t('baseUrlHint')}
            copyLabel={t('copyBaseUrl')}
          />
        </SettingsCard>
      </SettingsSection>

      <GodScimGroupList />

      {generating && <GodScimTokenDialog onClose={() => setGenerating(false)} />}
    </div>
  );
}
