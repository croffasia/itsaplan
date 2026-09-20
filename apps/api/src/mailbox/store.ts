import { and, eq, sql } from 'drizzle-orm';
import { db, projectMailSummary, projectMailboxSetting } from '@repo/db';
import { decryptSecret, encryptSecret } from '@repo/crypto';

export type SmtpSecurity = 'ssl' | 'starttls';

export interface MailboxConfig {
  email: string;
  username: string;
  password: string;
  imapHost: string;
  smtpHost: string;
  smtpPort: 465 | 587;
  smtpSecurity: SmtpSecurity;
}

export interface MailboxSettings {
  connected: boolean;
  email: string;
  username: string;
  hasPassword: boolean;
  imapHost: string;
  smtpHost: string;
  smtpPort: 465 | 587;
  smtpSecurity: SmtpSecurity;
}

export type MailboxSettingsInput = Omit<MailboxConfig, 'password'> & { password?: string };

export function defaultMailboxSettings(): MailboxSettings {
  return {
    connected: false,
    email: '',
    username: '',
    hasPassword: false,
    imapHost: 'imappro.zoho.com',
    smtpHost: 'smtppro.zoho.com',
    smtpPort: 465,
    smtpSecurity: 'ssl',
  };
}

function toSettings(config: MailboxConfig): MailboxSettings {
  return {
    connected: true,
    email: config.email,
    username: config.username,
    hasPassword: config.password.length > 0,
    imapHost: config.imapHost,
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    smtpSecurity: config.smtpSecurity,
  };
}

export async function getMailboxConfig(projectId: number): Promise<MailboxConfig | null> {
  const [row] = await db
    .select({
      ciphertext: projectMailboxSetting.ciphertext,
      iv: projectMailboxSetting.iv,
      authTag: projectMailboxSetting.authTag,
    })
    .from(projectMailboxSetting)
    .where(eq(projectMailboxSetting.projectId, projectId));
  if (!row) return null;
  return JSON.parse(decryptSecret(row)) as MailboxConfig;
}

export async function getMailboxSettings(projectId: number): Promise<MailboxSettings> {
  const [row] = await db
    .select({ redacted: projectMailboxSetting.redacted })
    .from(projectMailboxSetting)
    .where(eq(projectMailboxSetting.projectId, projectId));
  return row ? (row.redacted as MailboxSettings) : defaultMailboxSettings();
}

export async function resolveMailboxConfig(
  projectId: number,
  input: MailboxSettingsInput,
): Promise<MailboxConfig> {
  const current = await getMailboxConfig(projectId);
  const password = input.password || current?.password || '';
  return { ...input, password };
}

export async function saveMailboxConfig(
  projectId: number,
  config: MailboxConfig,
): Promise<MailboxSettings> {
  const encrypted = encryptSecret(JSON.stringify(config));
  const redacted = toSettings(config);
  await db
    .insert(projectMailboxSetting)
    .values({ projectId, ...encrypted, redacted })
    .onConflictDoUpdate({
      target: projectMailboxSetting.projectId,
      set: { ...encrypted, redacted, updatedAt: sql`now()` },
    });
  return redacted;
}

export async function deleteMailboxConfig(projectId: number): Promise<void> {
  await db.delete(projectMailboxSetting).where(eq(projectMailboxSetting.projectId, projectId));
}

export async function getStoredMailSummary(
  projectId: number,
  messageKey: string,
): Promise<string | null> {
  const [row] = await db
    .select({ summary: projectMailSummary.summary })
    .from(projectMailSummary)
    .where(
      and(
        eq(projectMailSummary.projectId, projectId),
        eq(projectMailSummary.messageKey, messageKey),
      ),
    );
  return row?.summary ?? null;
}

export async function saveMailSummary(
  projectId: number,
  messageKey: string,
  summary: string,
): Promise<void> {
  await db
    .insert(projectMailSummary)
    .values({ projectId, messageKey, summary })
    .onConflictDoNothing({
      target: [projectMailSummary.projectId, projectMailSummary.messageKey],
    });
}
