'use client';

import type { ReactNode } from 'react';
import { toast } from 'sonner';
import type { InstanceAuthSettings } from '@/lib/api';
import SettingsCard from '@/components/common/page/SettingsCard';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import GodSectionPage from './components/GodSectionPage';
import GodSettingsGate from './components/GodSettingsGate';
import RegistrationModePicker from './components/authentication/RegistrationModePicker';
import { useGodPolicyForm } from './hooks/useGodPolicyForm';
import { useInstanceAuthSettingsQuery } from './services/god.service';

// A settings group: a plain heading above a filled block. The heading stays outside
// the block so the page reads as a list of groups.
function Group({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

// A policy row inside a group: label and description on the left, the switch on the
// right. The dividers come from the card.
function Row({
  title,
  description,
  disabledNote,
  control,
}: {
  title: string;
  description: string;
  disabledNote?: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 p-4">
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{title}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {disabledNote && <p className="text-xs text-muted-foreground">{disabledNote}</p>}
      </div>
      {control}
    </div>
  );
}

export default function GodAuthenticationPage() {
  const auth = useInstanceAuthSettingsQuery();

  return (
    <GodSettingsGate slug="authentication" data={auth.data}>
      {(settings) => <AuthenticationForm authSettings={settings} />}
    </GodSettingsGate>
  );
}

// The registration policy and the sign-in options. The provider credentials live
// under Integrations (Email provider, Auth provider).
function AuthenticationForm({ authSettings }: { authSettings: InstanceAuthSettings }) {
  const policy = useGodPolicyForm(authSettings);

  // The options that send mail need a configured provider; the API rejects them
  // without one.
  const needsProvider = !authSettings.hasEmailProvider;

  async function save() {
    try {
      await policy.save();
      toast.success('Authentication settings saved');
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <GodSectionPage
      slug="authentication"
      actions={
        <Button size="sm" onClick={() => void save()} disabled={!policy.dirty || policy.saving}>
          {policy.saving ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <div className="space-y-10">
        <Group title="Registration" description="Who may create an account on this instance.">
          <SettingsCard className="divide-y divide-border/60">
            <RegistrationModePicker
              value={policy.registration}
              disabled={policy.saving}
              onChange={policy.setRegistration}
            />
          </SettingsCard>
        </Group>

        <Group
          title="Sign-in options"
          description="Options that need outbound mail. They stay off until a provider is configured."
        >
          <SettingsCard className="divide-y divide-border/60">
            <Row
              title="Require email confirmation"
              description="A new account must confirm its address before it can sign in."
              disabledNote={
                needsProvider ? 'Set up the Email provider under Integrations first.' : undefined
              }
              control={
                <Switch
                  checked={policy.requireEmailVerification}
                  disabled={policy.saving || needsProvider}
                  onCheckedChange={policy.setRequireEmailVerification}
                />
              }
            />
            <Row
              title="Sign-in links"
              description="Offer signing in with a link sent by email, alongside the password."
              disabledNote={
                needsProvider ? 'Set up the Email provider under Integrations first.' : undefined
              }
              control={
                <Switch
                  checked={policy.magicLink}
                  disabled={policy.saving || needsProvider}
                  onCheckedChange={policy.setMagicLink}
                />
              }
            />
          </SettingsCard>
        </Group>
      </div>
    </GodSectionPage>
  );
}
