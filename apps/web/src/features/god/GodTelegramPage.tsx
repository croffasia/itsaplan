'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { InstanceTelegramSettings } from '@/lib/api';
import SettingsCard from '@/components/common/page/SettingsCard';
import EnabledSwitch from '@/components/common/inputs/EnabledSwitch';
import SecretInput from '@/components/common/inputs/SecretInput';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import GodSectionPage from './components/GodSectionPage';
import GodSettingsGate from './components/GodSettingsGate';
import {
  useInstanceTelegramSettingsQuery,
  useUpdateInstanceTelegramSettings,
} from './services/god.service';

export default function GodTelegramPage() {
  const query = useInstanceTelegramSettingsQuery();

  return (
    <GodSettingsGate slug="telegram" data={query.data}>
      {(settings) => <TelegramForm settings={settings} />}
    </GodSettingsGate>
  );
}

function TelegramForm({ settings }: { settings: InstanceTelegramSettings }) {
  const update = useUpdateInstanceTelegramSettings();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [botToken, setBotToken] = useState('');

  const hasToken = settings.hasBotToken || botToken.length > 0;
  const dirty = enabled !== settings.enabled || botToken.length > 0;

  async function save() {
    try {
      await update.mutateAsync({
        enabled: enabled && hasToken,
        ...(botToken.length > 0 ? { botToken } : {}),
      });
      setBotToken('');
      toast.success('Telegram settings saved');
    } catch {
      // The failure already surfaced through the global mutation error toast. A token
      // Telegram rejects comes back as a 400 with what it said.
    }
  }

  return (
    <GodSectionPage
      slug="telegram"
      actions={
        <Button size="sm" onClick={() => void save()} disabled={!dirty || update.isPending}>
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <SettingsSection
        title="Bot"
        description={
          hasToken
            ? 'People connect their Telegram account by opening a chat with this bot from their profile.'
            : 'Create a bot with @BotFather in Telegram and paste its token here.'
        }
        action={
          <EnabledSwitch
            checked={enabled}
            onChange={setEnabled}
            disabled={update.isPending || !hasToken}
          />
        }
      >
        <SettingsCard className="space-y-6 p-4">
          <div className="space-y-1.5 sm:max-w-md">
            <Label htmlFor="telegram-bot-token">Bot token</Label>
            <SecretInput
              id="telegram-bot-token"
              value={botToken}
              onChange={setBotToken}
              hasStored={settings.hasBotToken}
              editable
              placeholder="123456789:AA…"
            />
            <p className="text-xs text-muted-foreground">
              The token is verified with Telegram when you save, so a wrong one is refused here
              rather than failing silently later.
            </p>
          </div>

          {settings.botUsername && (
            <div className="space-y-1 border-t border-border/60 pt-4">
              <div className="text-sm font-medium">Bot</div>
              <p className="font-mono text-xs">@{settings.botUsername}</p>
              <p className="text-xs text-muted-foreground">
                Resolved from the token. This is the bot people will see when connecting.
              </p>
            </div>
          )}
        </SettingsCard>
      </SettingsSection>
    </GodSectionPage>
  );
}
