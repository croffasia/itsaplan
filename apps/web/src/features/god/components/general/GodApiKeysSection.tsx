'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { ApiKeySettings } from '@/lib/api/endpoints/god';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Input } from '@/components/ui/input';
import { useUpdateInstanceApiKeySettings } from '../../services/god.service';
import { wholeNumberIn } from '../../utils/numbers';

// The highest limit the api takes.
const MAX_REQUESTS_PER_MINUTE = 100_000;

export default function GodApiKeysSection({ settings }: { settings: ApiKeySettings }) {
  const t = useTranslations('god.general');
  const update = useUpdateInstanceApiKeySettings();
  // The limit as typed, or null while it shows the stored one.
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? String(settings.requestsPerMinute);
  const valid = wholeNumberIn(value, 0, MAX_REQUESTS_PER_MINUTE);

  // A typed number, so it saves on leaving the field or Enter rather than on each key.
  async function save() {
    if (draft === null || !valid) return;
    if (Number(draft) !== settings.requestsPerMinute) {
      try {
        await update.mutateAsync({ requestsPerMinute: Number(draft) });
        toast.success(t('apiKeysSaved'));
      } catch {
        // The failure already surfaced through the global mutation error toast.
      }
    }
    setDraft(null);
  }

  return (
    <SettingsSection title={t('apiKeys')}>
      <SettingsCard>
        <SettingsRow
          title={t('keyRequestsPerMinute')}
          description={t('keyRequestsPerMinuteHint')}
          note={
            valid ? undefined : t('keyRequestsPerMinuteInvalid', { max: MAX_REQUESTS_PER_MINUTE })
          }
          control={
            <Input
              type="number"
              min={0}
              max={MAX_REQUESTS_PER_MINUTE}
              step={1}
              inputMode="numeric"
              className="w-28"
              aria-label={t('keyRequestsPerMinute')}
              aria-invalid={!valid}
              value={value}
              disabled={update.isPending}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void save()}
              onKeyDown={(e) => e.key === 'Enter' && void save()}
            />
          }
        />
      </SettingsCard>
    </SettingsSection>
  );
}
