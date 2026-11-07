'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { SharingSettings } from '@/lib/api/endpoints/god';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Switch } from '@/components/ui/switch';
import { useUpdateInstanceSharingSettings } from '../../services/god.service';

export default function GodSharingSection({ sharing }: { sharing: SharingSettings }) {
  const t = useTranslations('god.general');
  const update = useUpdateInstanceSharingSettings();

  async function setEnabled(enabled: boolean) {
    try {
      await update.mutateAsync({ enabled });
      toast.success(t('sharingSaved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <SettingsSection title={t('sharing')}>
      <SettingsCard>
        <SettingsRow
          title={t('sharingEnabled')}
          description={t('sharingEnabledHint')}
          control={
            <Switch
              checked={sharing.enabled}
              disabled={update.isPending}
              onCheckedChange={(checked) => void setEnabled(checked)}
            />
          }
        />
      </SettingsCard>
    </SettingsSection>
  );
}
