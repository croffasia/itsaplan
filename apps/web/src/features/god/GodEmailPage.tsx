'use client';

import { toast } from 'sonner';
import type { InstanceEmailSettings } from '@/lib/api';
import { Button } from '@/components/ui/button';
import GodEmailSettings from './components/email/GodEmailSettings';
import GodSectionPage from './components/GodSectionPage';
import GodSettingsGate from './components/GodSettingsGate';
import { useGodEmailForm } from './hooks/useGodEmailForm';
import { useInstanceEmailSettingsQuery } from './services/god.service';

export default function GodEmailPage() {
  const query = useInstanceEmailSettingsQuery();

  return (
    <GodSettingsGate slug="email" data={query.data}>
      {(settings) => <EmailForm settings={settings} />}
    </GodSettingsGate>
  );
}

function EmailForm({ settings }: { settings: InstanceEmailSettings }) {
  const form = useGodEmailForm(settings);

  async function save() {
    try {
      await form.save();
      toast.success('Email provider saved');
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <GodSectionPage
      slug="email"
      actions={
        <Button size="sm" onClick={() => void save()} disabled={!form.dirty || form.saving}>
          {form.saving ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <GodEmailSettings form={form} />
    </GodSectionPage>
  );
}
