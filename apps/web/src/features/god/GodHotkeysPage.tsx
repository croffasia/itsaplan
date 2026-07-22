'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { HotkeyOverrides } from '@/lib/api';
import { DEFAULT_COMBOS } from '@/utils/hotkeys';
import HotkeysEditor from '@/components/common/hotkeys/HotkeysEditor';
import { Button } from '@/components/ui/button';
import GodSectionPage from './components/GodSectionPage';
import {
  useInstanceHotkeySettingsQuery,
  useUpdateInstanceHotkeySettings,
} from '@/services/hotkeys.service';

// The instance keyboard shortcuts. What is stored is the set of commands rebound
// away from their built-in key; a row reset to the default drops out of the map.
export default function GodHotkeysPage() {
  const query = useInstanceHotkeySettingsQuery();
  const update = useUpdateInstanceHotkeySettings();
  const [draft, setDraft] = useState<HotkeyOverrides | null>(null);

  const stored = query.data;
  const overrides = draft ?? stored ?? {};
  const dirty = stored != null && JSON.stringify(overrides) !== JSON.stringify(stored);

  async function save() {
    try {
      await update.mutateAsync(overrides);
      setDraft(null);
      toast.success('Keyboard shortcuts saved');
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <GodSectionPage
      slug="hotkeys"
      actions={
        <Button size="sm" disabled={!dirty || update.isPending} onClick={() => void save()}>
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      {stored == null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <HotkeysEditor base={DEFAULT_COMBOS} overrides={overrides} onChange={setDraft} />
      )}
    </GodSectionPage>
  );
}
