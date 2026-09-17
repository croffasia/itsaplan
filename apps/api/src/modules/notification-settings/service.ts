import {
  db,
  teamNotificationSetting,
  defaultNotificationConfig,
  readNotificationConfig,
  type NotificationConfig,
} from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { encryptSecret } from '@repo/crypto';
import { HttpError } from '#shared/lib';

// The settings UI over a team's notification provider credentials: the outbound
// channels every project of the team delivers through (SMTP or Resend for email, a
// Telegram bot). One row per team, managed by its owner. The stored shape and the
// decrypting reader live in @repo/db (the worker sends with them); what is here is
// the redacted view the UI reads, the partial write, and the validation. The
// plaintext config is never returned over HTTP. Which events reach a given member,
// and their Telegram chat id, are a per-user choice held in
// notification-preferences, not here.

// SMTP transport encryption. 'none' is plain (STARTTLS is negotiated by the
// sender when offered); 'ssl' is implicit TLS; 'tls' forces STARTTLS.
export const ENCRYPTION_MODES = ['none', 'ssl', 'tls'] as const;
export type EncryptionMode = (typeof ENCRYPTION_MODES)[number];

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

// The redacted settings for a team. Defaults (no secrets, no provider of its own,
// delivery through the instance provider) when nothing has been saved.
export async function getNotificationSettings(teamId: number): Promise<NotificationSettingsDto> {
  const config = (await readNotificationConfig(teamId)) ?? defaultNotificationConfig();
  return toDto(config);
}

// Applies a patch and returns the redacted result. Upserts the single row.
export async function setNotificationSettings(
  teamId: number,
  patch: NotificationSettingsPatch,
): Promise<NotificationSettingsDto> {
  const current = (await readNotificationConfig(teamId)) ?? defaultNotificationConfig();
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
  // Merge over the default, as the stored reader does, so a row written before a
  // field was added stays valid.
  return { ...toDto(defaultNotificationConfig()), ...(redacted ?? {}) };
}
