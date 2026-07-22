import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsCard from '@/components/common/page/SettingsCard';
import EnabledSwitch from '@/components/common/inputs/EnabledSwitch';
import SecretInput from '@/components/common/inputs/SecretInput';
import type { GodGoogleForm } from '../../hooks/useGodGoogleForm';

// The Google OAuth credentials from the Google Cloud console. The
// redirect URI is derived from the API origin and shown read-only, since it has to be
// registered on the OAuth client for the round trip to work at all.
export default function GodGoogleSettings({ form }: { form: GodGoogleForm }) {
  const [copied, setCopied] = useState(false);

  async function copyRedirectUri() {
    try {
      await navigator.clipboard.writeText(form.settings.redirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (no permission / insecure origin); ignore.
    }
  }

  return (
    <SettingsSection
      title="Google"
      description={
        form.hasCredentials
          ? 'An address without an account gets one; an address that already has a confirmed account signs into it.'
          : 'Add the client ID and secret first.'
      }
      action={
        <EnabledSwitch
          checked={form.enabled}
          onChange={form.setEnabled}
          disabled={form.saving || !form.hasCredentials}
        />
      }
    >
      <SettingsCard className="space-y-6 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="google-client-id">Client ID</Label>
            <Input
              id="google-client-id"
              value={form.clientId}
              onChange={(e) => form.setClientId(e.target.value)}
              placeholder="…apps.googleusercontent.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="google-client-secret">Client secret</Label>
            <SecretInput
              id="google-client-secret"
              value={form.clientSecret}
              onChange={form.setClientSecret}
              hasStored={form.settings.hasClientSecret}
              editable
              placeholder="GOCSPX-…"
            />
          </div>
        </div>

        {/* Read-only, so it reads as something to copy out rather than a field to fill
            in. It is not part of the form and never saved. */}
        <div className="flex items-start justify-between gap-4 border-t border-border/60 pt-4">
          <div className="min-w-0 space-y-1">
            <div className="text-sm font-medium">Redirect URI</div>
            <p className="truncate font-mono text-xs">{form.settings.redirectUri}</p>
            <p className="text-xs text-muted-foreground">
              Register this on the OAuth client in the Google Cloud console. Google refuses the
              sign-in if it does not match exactly.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            title="Copy redirect URI"
            onClick={() => void copyRedirectUri()}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
