import { db, teamNotificationSetting } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { encryptSecret, decryptSecret } from '@repo/crypto';
import type { SmtpConfig, ResendConfig } from '@repo/mailer';
import { HttpError } from '#shared/lib';

// Data access for a team's notification provider credentials: the outbound channels
// every project of the team delivers through (SMTP or Resend for email, a Telegram
// bot). One row per team, managed by its owner. The full config carries secrets, so
// it is stored encrypted as one JSON blob; the `redacted` column holds the same
// config with secret values dropped and replaced by `hasX` flags, for the settings
// UI. The plaintext config is only read by the delivery sender; it is never returned
// over HTTP. Which events reach a given member, and their Telegram chat id, are a
// per-user choice held in notification-preferences, not here.

// SMTP transport encryption. 'none' is plain (STARTTLS is negotiated by the
// sender when offered); 'ssl' is implicit TLS; 'tls' forces STARTTLS.
export const ENCRYPTION_MODES = ['none', 'ssl', 'tls'] as const;
export type EncryptionMode = (typeof ENCRYPTION_MODES)[number];

interface TelegramConfig {
  enabled: boolean;
  botToken: string; // secret
}

// The stored, decrypted config. Secret fields carry the plaintext value. Read by
// the delivery sender through getDeliveryConfig; never returned over HTTP.
export interface NotificationConfig {
  // Send email through the instance provider instead of the team's own. Carries
  // no credentials: they belong to the instance and are read at send time. A team
  // that enables SMTP or Resend of its own takes precedence over this.
  system: { enabled: boolean };
  smtp: SmtpConfig;
  resend: ResendConfig;
  telegram: TelegramConfig;
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

// The config as returned to the client: every secret replaced by a boolean
// telling whether a value is stored. Non-secret fields are verbatim.
export interface NotificationSettingsDto {
  system: { enabled: boolean };
  smtp: {
    enabled: boolean;
    host: string;
    port: number | null;
    encryption: EncryptionMode;
    username: string;
    hasPassword: boolean;
    timeout: number | null;
  };
  resend: { enabled: boolean; hasApiKey: boolean };
  telegram: { enabled: boolean; hasBotToken: boolean };
}

// A partial write. Each section, when present, replaces that section's non-secret
// fields; secret fields are optional and keep their stored value when left out or
// sent empty (a masked field the user did not edit). A channel is turned off with
// its `enabled` flag rather than by clearing the secret.
export interface NotificationSettingsPatch {
  system?: { enabled: boolean };
  smtp?: {
    enabled: boolean;
    host: string;
    port: number | null;
    encryption: EncryptionMode;
    username: string;
    password?: string;
    timeout: number | null;
  };
  resend?: { enabled: boolean; apiKey?: string };
  telegram?: { enabled: boolean; botToken?: string };
}

function defaultConfig(): NotificationConfig {
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

function toDto(config: NotificationConfig): NotificationSettingsDto {
  return {
    system: { enabled: config.system.enabled },
    smtp: {
      enabled: config.smtp.enabled,
      host: config.smtp.host,
      port: config.smtp.port,
      encryption: config.smtp.encryption,
      username: config.smtp.username,
      hasPassword: config.smtp.password.length > 0,
      timeout: config.smtp.timeout,
    },
    resend: { enabled: config.resend.enabled, hasApiKey: config.resend.apiKey.length > 0 },
    telegram: {
      enabled: config.telegram.enabled,
      hasBotToken: config.telegram.botToken.length > 0,
    },
  };
}

// A secret patch value: use the new value only when the caller sent a non-empty
// string; an omitted or empty field keeps the stored secret.
function mergeSecret(current: string, next: string | undefined): string {
  return next && next.length > 0 ? next : current;
}

// Applies a partial patch over the stored (or default) config, preserving
// unchanged secrets.
function applyPatch(
  current: NotificationConfig,
  patch: NotificationSettingsPatch,
): NotificationConfig {
  const next: NotificationConfig = {
    system: { ...current.system },
    smtp: { ...current.smtp },
    resend: { ...current.resend },
    telegram: { ...current.telegram },
  };

  if (patch.system) next.system = { enabled: patch.system.enabled };
  if (patch.smtp) {
    next.smtp = {
      enabled: patch.smtp.enabled,
      host: patch.smtp.host.trim(),
      port: patch.smtp.port,
      encryption: patch.smtp.encryption,
      username: patch.smtp.username.trim(),
      password: mergeSecret(current.smtp.password, patch.smtp.password),
      timeout: patch.smtp.timeout,
    };
  }
  if (patch.resend) {
    next.resend = {
      enabled: patch.resend.enabled,
      apiKey: mergeSecret(current.resend.apiKey, patch.resend.apiKey),
    };
  }
  if (patch.telegram) {
    next.telegram = {
      enabled: patch.telegram.enabled,
      botToken: mergeSecret(current.telegram.botToken, patch.telegram.botToken),
    };
  }

  return next;
}

// An enabled provider with no usable credentials drops every message in the delivery
// path without reporting an error. Checked on the merged config, so a save that leaves
// a stored secret untouched passes.
function assertSendable(config: NotificationConfig): void {
  if (config.smtp.enabled) {
    if (config.smtp.host.length === 0) throw new HttpError(400, 'SMTP host is required');
    if (config.smtp.username.length > 0 && config.smtp.password.length === 0) {
      throw new HttpError(400, 'SMTP password is required for this username');
    }
  }
  if (config.resend.enabled && config.resend.apiKey.length === 0) {
    throw new HttpError(400, 'A Resend API key is required');
  }
}

// Reads and decrypts the stored config, or null when the team has none yet.
async function readConfig(teamId: number): Promise<NotificationConfig | null> {
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
  return { ...defaultConfig(), ...(JSON.parse(decryptSecret(row)) as NotificationConfig) };
}

// The redacted settings for a team. Defaults (no secrets, no provider of its own,
// delivery through the instance provider) when nothing has been saved.
export async function getNotificationSettings(teamId: number): Promise<NotificationSettingsDto> {
  const config = (await readConfig(teamId)) ?? defaultConfig();
  return toDto(config);
}

// Applies a patch and returns the redacted result. Upserts the single row.
export async function setNotificationSettings(
  teamId: number,
  patch: NotificationSettingsPatch,
): Promise<NotificationSettingsDto> {
  const current = (await readConfig(teamId)) ?? defaultConfig();
  const next = applyPatch(current, patch);
  assertSendable(next);
  const redacted = toDto(next);
  const enc = encryptSecret(JSON.stringify(next));
  await db
    .insert(teamNotificationSetting)
    .values({
      teamId,
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      authTag: enc.authTag,
      redacted,
    })
    .onConflictDoUpdate({
      target: teamNotificationSetting.teamId,
      set: {
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        authTag: enc.authTag,
        redacted,
        updatedAt: sql`now()`,
      },
    });
  return redacted;
}

// The redacted settings read straight from the plaintext `redacted` column, without
// decrypting. Used by the outbound enqueue path to decide which channels are enabled.
// Cheaper than getNotificationSettings, which decrypts the secret blob. A team that
// saved nothing gets the defaults, so it delivers through the instance provider.
export async function readRedactedSettings(teamId: number): Promise<NotificationSettingsDto> {
  const rows = await db
    .select({ redacted: teamNotificationSetting.redacted })
    .from(teamNotificationSetting)
    .where(eq(teamNotificationSetting.teamId, teamId));
  const redacted = rows[0]?.redacted as NotificationSettingsDto | undefined;
  // Merge over the default, as readConfig does, so a row written before a field was
  // added stays valid.
  return { ...toDto(defaultConfig()), ...(redacted ?? {}) };
}

// The full decrypted config, for the sender that actually delivers a notification.
// Carries secrets, so it is only called server-side by the delivery sender.
export async function getDeliveryConfig(teamId: number): Promise<NotificationConfig> {
  return (await readConfig(teamId)) ?? defaultConfig();
}
