'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { ApiKeySettings } from '@/lib/api/endpoints/god';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import { useUpdateInstanceApiKeySettings } from '../../services/god.service';
import GodLimitRow from './GodLimitRow';

// The highest limit the api takes.
const MAX_REQUESTS_PER_MINUTE = 100_000;

export default function GodApiKeysSection({ settings }: { settings: ApiKeySettings }) {
  const t = useTranslations('god.general');
  const update = useUpdateInstanceApiKeySettings();

  async function save(requestsPerMinute: number) {
    try {
      await update.mutateAsync({ requestsPerMinute });
      toast.success(t('apiKeysSaved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <SettingsSection title={t('apiKeys')}>
      <SettingsCard>
        <GodLimitRow
          title={t('keyRequestsPerMinute')}
          description={t('keyRequestsPerMinuteHint')}
          value={settings.requestsPerMinute}
          max={MAX_REQUESTS_PER_MINUTE}
          invalidNote={t('keyRequestsPerMinuteInvalid', { max: MAX_REQUESTS_PER_MINUTE })}
          disabled={update.isPending}
          inputClassName="w-28"
          onSave={save}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
