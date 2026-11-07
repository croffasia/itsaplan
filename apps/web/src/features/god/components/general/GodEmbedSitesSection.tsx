'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { EmbedSites } from '@/lib/api/endpoints/god';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUpdateInstanceEmbedSites } from '../../services/god.service';
import { isSiteAddress, parseSiteAddresses } from '../../utils/siteAddresses';

// The sites that may show the shared work items and views, and the public pages, in a
// frame. Every other site, and every other page, is refused one.
export default function GodEmbedSitesSection({ sites }: { sites: EmbedSites }) {
  const t = useTranslations('god.general');
  const tCommon = useTranslations('common');
  const update = useUpdateInstanceEmbedSites();
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? sites.origins.join(', ');
  const typed = parseSiteAddresses(shown);
  const valid = typed.every(isSiteAddress);
  const dirty = text !== null && typed.join() !== sites.origins.join();

  async function save() {
    try {
      await update.mutateAsync(typed);
      setText(null);
      toast.success(t('embedSaved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <SettingsSection title={t('embedding')}>
      <SettingsCard>
        <SettingsRow
          title={t('embedSites')}
          description={t('embedSitesHint')}
          note={valid ? undefined : t('embedSitesInvalid')}
          control={
            <div className="flex shrink-0 items-center gap-2">
              <Input
                className="w-40 sm:w-72"
                placeholder="https://example.com"
                aria-label={t('embedSites')}
                aria-invalid={!valid}
                value={shown}
                disabled={update.isPending}
                onChange={(e) => setText(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!dirty || !valid || update.isPending}
                onClick={() => void save()}
              >
                {tCommon('save')}
              </Button>
            </div>
          }
        />
      </SettingsCard>
    </SettingsSection>
  );
}
