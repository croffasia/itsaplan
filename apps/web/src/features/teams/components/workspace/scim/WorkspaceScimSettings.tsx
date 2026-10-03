'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { WorkspaceScimSettings as Settings } from '@/lib/api/endpoints/workspaces';
import { useUpdateWorkspaceScim } from '@/services/workspaces.service';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsCard from '@/components/common/page/SettingsCard';
import CopyableValue from '@/components/common/page/CopyableValue';
import EnabledSwitch from '@/components/common/inputs/EnabledSwitch';
import { Button } from '@/components/ui/button';
import WorkspaceScimTokenDialog from './WorkspaceScimTokenDialog';
import WorkspaceScimGroupList from './WorkspaceScimGroupList';

// The endpoint and the token go into the identity provider; the groups it then
// pushes appear below, where the owner says what each one grants.
export default function WorkspaceScimSettings({
  workspaceId,
  settings,
}: {
  workspaceId: number;
  settings: Settings;
}) {
  const t = useTranslations('teams.workspace.scim');
  const update = useUpdateWorkspaceScim(workspaceId);
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

      <WorkspaceScimGroupList workspaceId={workspaceId} />

      {generating && (
        <WorkspaceScimTokenDialog workspaceId={workspaceId} onClose={() => setGenerating(false)} />
      )}
    </div>
  );
}
