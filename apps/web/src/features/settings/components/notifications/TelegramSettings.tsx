import { Label } from '@/components/ui/label';
import SettingsSection from '@/components/common/page/SettingsSection';
import EnabledSwitch from '@/components/common/inputs/EnabledSwitch';
import SecretInput from '@/components/common/inputs/SecretInput';
import type { TelegramForm } from '../../hooks/useTelegramForm';

// The bot this project delivers through. The token is optional: left empty, the
// project sends through the instance bot that members connect their Telegram account
// to. Members do not enter a chat anywhere, it comes from that connected account.
// The token is sent only when changed.
export default function TelegramSettings({ form }: { form: TelegramForm }) {
  const { settings, editable } = form;
  return (
    <SettingsSection
      title="Telegram bot"
      description="The bot that delivers notifications. Members choose their own chat in their preferences. The token is stored encrypted."
      action={
        editable && (
          <EnabledSwitch checked={form.enabled} onChange={form.setEnabled} disabled={!editable} />
        )
      }
    >
      <div className="space-y-1.5 sm:max-w-md">
        <Label htmlFor="telegram-token">Bot API token (optional)</Label>
        <SecretInput
          id="telegram-token"
          value={form.botToken}
          onChange={form.setBotToken}
          hasStored={settings.telegram.hasBotToken}
          editable={editable}
          placeholder="123456:ABC-DEF…"
        />
      </div>
    </SettingsSection>
  );
}
