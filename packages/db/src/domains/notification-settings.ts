import { eq } from 'drizzle-orm';
import { decryptSecret } from '@repo/crypto';
import type { ResendConfig, SmtpConfig } from '@repo/mailer';
import { db } from '../client';
import { teamNotificationSetting } from '../schema/app';

// A team's notification provider credentials, stored encrypted as one JSON blob in
// team_notification_setting: the channels every project of the team delivers through.
// Read by the api (the settings UI reads the plaintext `redacted` mirror instead, and
// only the enabled flags) and by the worker, which sends with them. The api owns the
// write, so a field added here has to be set there too.

interface TelegramConfig {
  enabled: boolean;
  botToken: string; // secret
}

// The stored, decrypted config. Secret fields carry the plaintext value; read only
// by the sender, never returned over HTTP.
export interface NotificationConfig {
  // Send email through the instance provider instead of the team's own. Carries
  // no credentials: they belong to the instance and are read at send time. A team
  // that enables SMTP or Resend of its own takes precedence over this.
  system: { enabled: boolean };
  smtp: SmtpConfig;
  resend: ResendConfig;
  telegram: TelegramConfig;
}

export function defaultNotificationConfig(): NotificationConfig {
  return {
    // A team sends through the instance provider until it configures its own, so
    // notifications work out of the box wherever the instance shares one.
    system: { enabled: true },
    smtp: {
      enabled: false,
      host: '',
      port: 587,
      encryption: 'none',
      username: '',
      password: '',
      timeout: null,
    },
    resend: { enabled: false, apiKey: '' },
    telegram: { enabled: false, botToken: '' },
  };
}

// Which provider sends this team's email: its own SMTP/Resend when one is
// enabled, otherwise the instance provider when the team asked for it. 'none'
// means email delivery is off for the team.
export function emailSource(config: {
  system: { enabled: boolean };
  smtp: { enabled: boolean };
  resend: { enabled: boolean };
}): 'smtp' | 'resend' | 'system' | 'none' {
  if (config.smtp.enabled) return 'smtp';
  if (config.resend.enabled) return 'resend';
  return config.system.enabled ? 'system' : 'none';
}

// The stored config, or null when the team has none yet.
export async function readNotificationConfig(teamId: number): Promise<NotificationConfig | null> {
  const rows = await db
    .select({
      ciphertext: teamNotificationSetting.ciphertext,
      iv: teamNotificationSetting.iv,
      authTag: teamNotificationSetting.authTag,
    })
    .from(teamNotificationSetting)
    .where(eq(teamNotificationSetting.teamId, teamId));
  const row = rows[0];
  if (!row) return null;
  // Merge over the default so a config written before a field was added stays valid.
  return {
    ...defaultNotificationConfig(),
    ...(JSON.parse(decryptSecret(row)) as NotificationConfig),
  };
}

// The full decrypted config, for the sender that actually delivers a notification.
export async function getDeliveryConfig(teamId: number): Promise<NotificationConfig> {
  return (await readNotificationConfig(teamId)) ?? defaultNotificationConfig();
}
