'use client';

import { useState } from 'react';
import { toast } from 'sonner';
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
      toast.success('Storage settings saved');
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
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <div className="space-y-8">
        <SettingsSection
          title="File size"
          description="The largest single file an upload may carry. A bigger file is refused before it is stored."
        >
          <SettingsCard className="grid gap-6 p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="storage-attachment-mb">Attachment size (MB)</Label>
              <Input
                id="storage-attachment-mb"
                type="number"
                min={1}
                max={10240}
                value={form.maxAttachmentMb}
                onChange={(e) => set({ maxAttachmentMb: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Applies to issue attachments, files pasted into a description, and attachments added
                by agents.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="storage-avatar-mb">Avatar size (MB)</Label>
              <Input
                id="storage-avatar-mb"
                type="number"
                min={1}
                max={1024}
                value={form.maxAvatarMb}
                onChange={(e) => set({ maxAvatarMb: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                The profile picture people upload for their account.
              </p>
            </div>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection
          title="Accepted attachment types"
          description="One content type per line. Leave empty to accept any file."
        >
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
            <p className="text-xs text-muted-foreground">
              A line is a full type (application/pdf) or a wildcard (image/*). Files already stored
              are kept whatever the list says.
            </p>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection
          title="Project quota"
          description="Total attachment storage one project may use. 0 means no limit."
        >
          <SettingsCard className="space-y-2 p-4">
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="storage-project-quota-mb">Storage per project (MB)</Label>
              <Input
                id="storage-project-quota-mb"
                type="number"
                min={0}
                value={form.projectQuotaMb}
                onChange={(e) => set({ projectQuotaMb: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Once a project reaches the quota, new uploads are refused until someone deletes
              attachments.
            </p>
          </SettingsCard>
        </SettingsSection>
      </div>
    </GodSectionPage>
  );
}
