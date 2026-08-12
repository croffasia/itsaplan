'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { StorageSettings } from '@/lib/api';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import GodSectionPage from './components/GodSectionPage';
import GodSettingsGate from './components/GodSettingsGate';
import {
  useInstanceStorageSettingsQuery,
  useUpdateInstanceStorageSettings,
} from './services/god.service';

export default function GodStoragePage() {
  const query = useInstanceStorageSettingsQuery();

  return (
    <GodSettingsGate slug="storage" data={query.data}>
      {(settings) => <StorageForm settings={settingsToForm(settings)} />}
    </GodSettingsGate>
  );
}

interface FormState {
  maxAttachmentMb: string;
  maxAvatarMb: string;
  attachmentMimeTypes: string;
  projectQuotaMb: string;
}

function settingsToForm(settings: StorageSettings): FormState {
  return {
    maxAttachmentMb: String(settings.maxAttachmentMb),
    maxAvatarMb: String(settings.maxAvatarMb),
    // One type per line: the list is short and each entry is a whole value, so a
    // line is easier to read and edit than a comma-separated string.
    attachmentMimeTypes: settings.attachmentMimeTypes.join('\n'),
    projectQuotaMb: String(settings.projectQuotaMb),
  };
}

function StorageForm({ settings }: { settings: FormState }) {
  const t = useTranslations('god.storage');
  const tCommon = useTranslations('common');
  const update = useUpdateInstanceStorageSettings();
  const [form, setForm] = useState(settings);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const dirty = (Object.keys(form) as (keyof FormState)[]).some((k) => form[k] !== settings[k]);

  const maxAttachmentMb = Number(form.maxAttachmentMb);
  const maxAvatarMb = Number(form.maxAvatarMb);
  const projectQuotaMb = Number(form.projectQuotaMb);
  // The same bounds the api validates the body against, so an out-of-range value
  // disables Save instead of coming back as a 400.
  const inRange = (n: number, min: number, max: number) =>
    Number.isInteger(n) && n >= min && n <= max;
  const valid =
    inRange(maxAttachmentMb, 1, 10240) &&
    inRange(maxAvatarMb, 1, 1024) &&
    inRange(projectQuotaMb, 0, Number.MAX_SAFE_INTEGER);

  async function save() {
    try {
      await update.mutateAsync({
        maxAttachmentMb,
        maxAvatarMb,
        projectQuotaMb,
        attachmentMimeTypes: form.attachmentMimeTypes
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      });
      toast.success(t('saved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <GodSectionPage
      slug="storage"
      actions={
        <Button
          size="sm"
          onClick={() => void save()}
          disabled={!dirty || !valid || update.isPending}
        >
          {update.isPending ? tCommon('saving') : tCommon('save')}
        </Button>
      }
    >
      <div className="space-y-8">
        <SettingsSection title={t('fileSize')} description={t('fileSizeHint')}>
          <SettingsCard className="grid gap-6 p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="storage-attachment-mb">{t('attachmentMb')}</Label>
              <Input
                id="storage-attachment-mb"
                type="number"
                min={1}
                max={10240}
                value={form.maxAttachmentMb}
                onChange={(e) => set({ maxAttachmentMb: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t('attachmentHint')}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="storage-avatar-mb">{t('avatarMb')}</Label>
              <Input
                id="storage-avatar-mb"
                type="number"
                min={1}
                max={1024}
                value={form.maxAvatarMb}
                onChange={(e) => set({ maxAvatarMb: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t('avatarHint')}</p>
            </div>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title={t('mimeTypes')} description={t('mimeTypesHint')}>
          <SettingsCard className="space-y-2 p-4">
            <Textarea
              id="storage-mime-types"
              rows={8}
              spellCheck={false}
              className="font-mono text-xs"
              placeholder={'image/*\napplication/pdf'}
              value={form.attachmentMimeTypes}
              onChange={(e) => set({ attachmentMimeTypes: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">{t('mimeTypesNote')}</p>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title={t('quota')} description={t('quotaHint')}>
          <SettingsCard className="space-y-2 p-4">
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="storage-project-quota-mb">{t('quotaMb')}</Label>
              <Input
                id="storage-project-quota-mb"
                type="number"
                min={0}
                value={form.projectQuotaMb}
                onChange={(e) => set({ projectQuotaMb: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t('quotaNote')}</p>
          </SettingsCard>
        </SettingsSection>
      </div>
    </GodSectionPage>
  );
}
