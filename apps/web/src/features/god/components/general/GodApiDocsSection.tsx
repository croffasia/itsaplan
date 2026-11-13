'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { ApiDocsAudience, ApiDocsSettings } from '@/lib/api/endpoints/god';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import SettingsSection from '@/components/common/page/SettingsSection';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateInstanceApiDocsSettings } from '../../services/god.service';

const AUDIENCES: ApiDocsAudience[] = ['nobody', 'god', 'everyone'];

export default function GodApiDocsSection({ settings }: { settings: ApiDocsSettings }) {
  const t = useTranslations('god.general');
  const update = useUpdateInstanceApiDocsSettings();

  async function setAudience(audience: ApiDocsAudience) {
    try {
      await update.mutateAsync({ audience });
      toast.success(t('apiDocsSaved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <SettingsSection title={t('apiDocs')}>
      <SettingsCard>
        <SettingsRow
          title={t('apiDocsAudience')}
          description={t('apiDocsAudienceHint')}
          control={
            <Select
              value={settings.audience}
              disabled={update.isPending}
              onValueChange={(value) => void setAudience(value as ApiDocsAudience)}
            >
              <SelectTrigger className="w-56" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCES.map((audience) => (
                  <SelectItem key={audience} value={audience}>
                    {t(`apiDocsAudiences.${audience}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      </SettingsCard>
    </SettingsSection>
  );
}
