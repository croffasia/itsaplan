import { randomBytes, timingSafeEqual } from 'node:crypto';
import { db, appSecret, projectInvite, getSetting, setSetting } from '@repo/db';
import { and, eq, sql } from 'drizzle-orm';
import { encryptSecret, decryptSecret } from '@repo/crypto';
import {
  hasEmailProvider,
  type SmtpConfig,
  type ResendConfig,
  type EmailConfig,
} from '@repo/mailer';

// Instance-wide authentication settings: who may register, whether email has to be
// confirmed, which sign-in methods are offered, the mail provider used for
// authentication email, and the credentials of the OAuth providers. Read by the
// better-auth instance in ./index.ts (the registration gate, the mail senders, the
// Google and OIDC providers) and written by god mode in the api, so it lives here
// rather than in the api.
//
// Non-secret settings are one jsonb blob in app_setting under the 'auth' key; the
// credentials are encrypted in app_secret under 'auth.email', 'auth.google',
// 'auth.oidc' and 'auth.scim', each with a `redacted` mirror the settings UI can read
// without decrypting.

const AUTH_SETTING_KEY = 'auth';
const EMAIL_SECRET_KEY = 'auth.email';
const GOOGLE_SECRET_KEY = 'auth.google';
const OIDC_SECRET_KEY = 'auth.oidc';
const SCIM_SECRET_KEY = 'auth.scim';

// Who may create an account.
//   open   — anyone can sign up
//   invite — only with the token of an unused, unexpired invite link
//   closed — nobody; existing accounts still sign in
export const REGISTRATION_MODES = ['open', 'invite', 'closed'] as const;
export type RegistrationMode = (typeof REGISTRATION_MODES)[number];

export interface AuthSettings {
  registration: RegistrationMode;
  // Require a confirmed email address before the account can sign in. Needs a mail
  // provider, so the api rejects turning it on while none is configured.
  requireEmailVerification: boolean;
  // Offer sign-in by emailed link alongside the password.
  magicLink: boolean;
  // Offer the email/password form at all. Turning it off leaves single sign-on (and
  // passkeys, which are added to an account that already exists) as the way in, so
  // the api refuses to turn it off while no OAuth provider is configured.
  emailPassword: boolean;
}

function defaultAuthSettings(): AuthSettings {
  return {
    registration: 'open',
    requireEmailVerification: false,
    magicLink: false,
    emailPassword: true,
  };
}

export async function getAuthSettings(): Promise<AuthSettings> {
  const stored = await getSetting<Partial<AuthSettings>>(AUTH_SETTING_KEY);
  // Merge over the default so a value written before a field was added stays valid.
  return { ...defaultAuthSettings(), ...(stored ?? {}) };
}

export async function setAuthSettings(patch: Partial<AuthSettings>): Promise<AuthSettings> {
  const next = { ...(await getAuthSettings()), ...patch };
  await setSetting(AUTH_SETTING_KEY, next);
  return next;
}

// ── Encrypted config storage ──────────────────────────────────────────────────

// Every credential is stored the same way: one JSON blob per key in app_secret,
// encrypted as a whole, with a `redacted` mirror the settings UI reads without
// decrypting.

async function readSecret<T>(key: string): Promise<T | null> {
  const rows = await db
    .select({ ciphertext: appSecret.ciphertext, iv: appSecret.iv, authTag: appSecret.authTag })
    .from(appSecret)
    .where(eq(appSecret.key, key));
  const row = rows[0];
  return row ? (JSON.parse(decryptSecret(row)) as T) : null;
}

async function writeSecret(key: string, value: unknown, redacted: object): Promise<void> {
  const enc = encryptSecret(JSON.stringify(value));
  await db
    .insert(appSecret)
    .values({
      key,
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      authTag: enc.authTag,
      redacted,
    })
    .onConflictDoUpdate({
      target: appSecret.key,
      set: {
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        authTag: enc.authTag,
        redacted,
        updatedAt: sql`now()`,
      },
    });
}

function mergeSecret(current: string, next: string | undefined): string {
  return next && next.length > 0 ? next : current;
}

// ── Mail provider ─────────────────────────────────────────────────────────────

// The stored, decrypted config. Secret fields carry the plaintext value; read only
// by the sender, never returned over HTTP.
export interface InstanceEmailConfig extends EmailConfig {
  smtp: SmtpConfig;
  resend: ResendConfig;
  from: string;
  // Let projects send their notifications through this provider instead of
  // configuring one of their own. Off by default: the instance owner pays for the
  // provider, so sharing it is an explicit decision.
  allowProjects: boolean;
}

// The config as returned to the client: every secret replaced by a boolean telling
// whether a value is stored.
export interface InstanceEmailDto {
  smtp: {
    enabled: boolean;
    host: string;
    port: number | null;
    encryption: SmtpConfig['encryption'];
    username: string;
    hasPassword: boolean;
    timeout: number | null;
  };
  resend: { enabled: boolean; hasApiKey: boolean };
  from: string;
  allowProjects: boolean;
}

// A partial write. Each section, when present, replaces that section's non-secret
// fields; a secret keeps its stored value when omitted or sent empty (a masked
// field the user did not edit).
export interface InstanceEmailPatch {
  smtp?: {
    enabled: boolean;
    host: string;
    port: number | null;
    encryption: SmtpConfig['encryption'];
    username: string;
    password?: string;
    timeout: number | null;
  };
  resend?: { enabled: boolean; apiKey?: string };
  from?: string;
  allowProjects?: boolean;
}

function defaultEmailConfig(): InstanceEmailConfig {
  return {
    smtp: {
      enabled: false,
      host: '',
      port: null,
      encryption: 'none',
      username: '',
      password: '',
      timeout: null,
    },
    resend: { enabled: false, apiKey: '' },
    from: '',
    allowProjects: false,
  };
}

function toEmailDto(config: InstanceEmailConfig): InstanceEmailDto {
  return {
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
    from: config.from,
    allowProjects: config.allowProjects,
  };
}

// Reads and decrypts the stored mail config, or null when nothing has been saved.
export async function getEmailConfig(): Promise<InstanceEmailConfig | null> {
  const stored = await readSecret<InstanceEmailConfig>(EMAIL_SECRET_KEY);
  if (!stored) return null;
  // Merge over the default so a config written before a field was added stays valid.
  return { ...defaultEmailConfig(), ...stored };
}

export async function getEmailSettings(): Promise<InstanceEmailDto> {
  return toEmailDto((await getEmailConfig()) ?? defaultEmailConfig());
}

// Whether outbound mail can be sent right now. Everything that mails the user
// (password reset, address confirmation, sign-in links) is unavailable without it,
// so both the god settings and the public sign-in screens ask this first.
export async function hasConfiguredEmailProvider(): Promise<boolean> {
  const config = await getEmailConfig();
  return config ? hasEmailProvider(config) : false;
}

// The instance provider a project may send its notifications through, or null when
// projects are not allowed to use it or it is not configured. Read by the api on the
// project notification paths (which channels are enabled, and the actual send).
export async function getProjectEmailConfig(): Promise<InstanceEmailConfig | null> {
  const config = await getEmailConfig();
  if (!config || !config.allowProjects) return null;
  return hasEmailProvider(config) ? config : null;
}

// Resolve a prospective configuration without persisting it. The email test route uses
// this so an owner can validate edited values first, while omitted secrets still reuse
// the encrypted value already on the instance.
export async function resolveEmailConfig(
  patch: InstanceEmailPatch = {},
): Promise<InstanceEmailConfig> {
  const current = (await getEmailConfig()) ?? defaultEmailConfig();
  return {
    smtp: patch.smtp
      ? { ...patch.smtp, password: mergeSecret(current.smtp.password, patch.smtp.password) }
      : current.smtp,
    resend: patch.resend
      ? {
          enabled: patch.resend.enabled,
          apiKey: mergeSecret(current.resend.apiKey, patch.resend.apiKey),
        }
      : current.resend,
    from: patch.from ?? current.from,
    allowProjects: patch.allowProjects ?? current.allowProjects,
  };
}

export async function setEmailSettings(patch: InstanceEmailPatch): Promise<InstanceEmailDto> {
  const next = await resolveEmailConfig(patch);
  const redacted = toEmailDto(next);
  await writeSecret(EMAIL_SECRET_KEY, next, redacted);
  return redacted;
}

// ── Google OAuth ──────────────────────────────────────────────────────────────

// The stored, decrypted credentials. Read by the Google provider in ./index.ts on
// every social request, never returned over HTTP.
export interface InstanceGoogleConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
}

// The config as returned to the client: the secret replaced by a boolean telling
// whether a value is stored.
export interface InstanceGoogleDto {
  enabled: boolean;
  clientId: string;
  hasClientSecret: boolean;
}

// A partial write. The secret keeps its stored value when omitted or sent empty (a
// masked field the user did not edit).
export interface InstanceGooglePatch {
  enabled?: boolean;
  clientId?: string;
  clientSecret?: string;
}

function defaultGoogleConfig(): InstanceGoogleConfig {
  return { enabled: false, clientId: '', clientSecret: '' };
}

function toGoogleDto(config: InstanceGoogleConfig): InstanceGoogleDto {
  return {
    enabled: config.enabled,
    clientId: config.clientId,
    hasClientSecret: config.clientSecret.length > 0,
  };
}

export async function getGoogleConfig(): Promise<InstanceGoogleConfig> {
  const stored = await readSecret<InstanceGoogleConfig>(GOOGLE_SECRET_KEY);
  // Merge over the default so a config written before a field was added stays valid.
  return { ...defaultGoogleConfig(), ...(stored ?? {}) };
}

export async function getGoogleSettings(): Promise<InstanceGoogleDto> {
  return toGoogleDto(await getGoogleConfig());
}

// Whether Google sign-in can run right now. The provider is always mounted, so this
// is what both the god settings and the public sign-in screen ask before offering it.
export function isGoogleUsable(config: InstanceGoogleConfig): boolean {
  return config.enabled && config.clientId.length > 0 && config.clientSecret.length > 0;
}

export async function hasConfiguredGoogle(): Promise<boolean> {
  return isGoogleUsable(await getGoogleConfig());
}

export async function setGoogleSettings(patch: InstanceGooglePatch): Promise<InstanceGoogleDto> {
  const current = await getGoogleConfig();
  const next: InstanceGoogleConfig = {
    enabled: patch.enabled ?? current.enabled,
    clientId: patch.clientId ?? current.clientId,
    clientSecret: mergeSecret(current.clientSecret, patch.clientSecret),
  };
  const redacted = toGoogleDto(next);
  await writeSecret(GOOGLE_SECRET_KEY, next, redacted);
  return redacted;
}

// ── Generic OIDC / OAuth2 ─────────────────────────────────────────────────────

// One OIDC provider per instance, discovered from its well-known document. The
// stored, decrypted credentials; read by the provider in ./index.ts on every
// request, never returned over HTTP.
export interface InstanceOidcConfig {
  enabled: boolean;
  // Text of the sign-in button. Free-form because it names the operator's own
  // identity provider, so the sign-in screen renders it as given rather than
  // translating it. Empty falls back to a translated default.
  label: string;
  // The provider's .well-known/openid-configuration. The authorization, token and
  // userinfo endpoints are read from it, so none of them is configured by hand.
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  pkce: boolean;
}

// The config as returned to the client: the secret replaced by a boolean telling
// whether a value is stored.
export interface InstanceOidcDto {
  enabled: boolean;
  label: string;
  discoveryUrl: string;
  clientId: string;
  hasClientSecret: boolean;
  scopes: string[];
  pkce: boolean;
}

// A partial write. The secret keeps its stored value when omitted or sent empty (a
// masked field the user did not edit).
export interface InstanceOidcPatch {
  enabled?: boolean;
  label?: string;
  discoveryUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scopes?: string[];
  pkce?: boolean;
}

function defaultOidcConfig(): InstanceOidcConfig {
  return {
    enabled: false,
    label: '',
    discoveryUrl: '',
    clientId: '',
    clientSecret: '',
    scopes: ['openid', 'profile', 'email'],
    pkce: true,
  };
}

function toOidcDto(config: InstanceOidcConfig): InstanceOidcDto {
  return {
    enabled: config.enabled,
    label: config.label,
    discoveryUrl: config.discoveryUrl,
    clientId: config.clientId,
    hasClientSecret: config.clientSecret.length > 0,
    scopes: config.scopes,
    pkce: config.pkce,
  };
}

export async function getOidcConfig(): Promise<InstanceOidcConfig> {
  const stored = await readSecret<InstanceOidcConfig>(OIDC_SECRET_KEY);
  // Merge over the default so a config written before a field was added stays valid.
  return { ...defaultOidcConfig(), ...(stored ?? {}) };
}

export async function getOidcSettings(): Promise<InstanceOidcDto> {
  return toOidcDto(await getOidcConfig());
}

// Whether OIDC sign-in can run right now. The provider is always mounted, so this is
// what both the god settings and the public sign-in screen ask before offering it.
export function isOidcUsable(config: InstanceOidcConfig): boolean {
  return (
    config.enabled &&
    config.discoveryUrl.length > 0 &&
    config.clientId.length > 0 &&
    config.clientSecret.length > 0
  );
}

export async function hasConfiguredOidc(): Promise<boolean> {
  return isOidcUsable(await getOidcConfig());
}

// The button text the sign-in screen shows, or an empty string when OIDC is not
// usable. Read by the public /auth-config.
export async function getOidcLabel(): Promise<string> {
  const config = await getOidcConfig();
  return isOidcUsable(config) ? config.label : '';
}

export async function setOidcSettings(patch: InstanceOidcPatch): Promise<InstanceOidcDto> {
  const current = await getOidcConfig();
  const next: InstanceOidcConfig = {
    enabled: patch.enabled ?? current.enabled,
    label: patch.label ?? current.label,
    discoveryUrl: patch.discoveryUrl ?? current.discoveryUrl,
    clientId: patch.clientId ?? current.clientId,
    clientSecret: mergeSecret(current.clientSecret, patch.clientSecret),
    scopes: patch.scopes ?? current.scopes,
    pkce: patch.pkce ?? current.pkce,
  };
  const redacted = toOidcDto(next);
  await writeSecret(OIDC_SECRET_KEY, next, redacted);
  return redacted;
}

// ── SCIM provisioning token ───────────────────────────────────────────────────

// The bearer token an identity provider sends to /scim/v2. One token per instance,
// generated here and shown to the owner once: only its prefix is kept in the
// redacted mirror, so a lost token is replaced rather than recovered.
export interface InstanceScimConfig {
  enabled: boolean;
  token: string;
}

export interface InstanceScimDto {
  enabled: boolean;
  hasToken: boolean;
  // First characters of the stored token, so the owner can tell which one an IdP
  // is configured with.
  tokenPrefix: string;
}

const SCIM_TOKEN_PREFIX = 'scim_';

function defaultScimConfig(): InstanceScimConfig {
  return { enabled: false, token: '' };
}

function toScimDto(config: InstanceScimConfig): InstanceScimDto {
  return {
    enabled: config.enabled,
    hasToken: config.token.length > 0,
    tokenPrefix: config.token.slice(0, SCIM_TOKEN_PREFIX.length + 6),
  };
}

async function getScimConfig(): Promise<InstanceScimConfig> {
  const stored = await readSecret<InstanceScimConfig>(SCIM_SECRET_KEY);
  return { ...defaultScimConfig(), ...(stored ?? {}) };
}

export async function getScimSettings(): Promise<InstanceScimDto> {
  return toScimDto(await getScimConfig());
}

export async function setScimSettings(patch: { enabled?: boolean }): Promise<InstanceScimDto> {
  const current = await getScimConfig();
  const next: InstanceScimConfig = { ...current, enabled: patch.enabled ?? current.enabled };
  const redacted = toScimDto(next);
  await writeSecret(SCIM_SECRET_KEY, next, redacted);
  return redacted;
}

// Mints a token, replacing any previous one, and returns it in the clear. This is
// the only time the value leaves the server.
export async function rotateScimToken(): Promise<string> {
  const current = await getScimConfig();
  const token = `${SCIM_TOKEN_PREFIX}${randomBytes(24).toString('hex')}`;
  const next: InstanceScimConfig = { ...current, token };
  await writeSecret(SCIM_SECRET_KEY, next, toScimDto(next));
  return token;
}

export async function isScimEnabled(): Promise<boolean> {
  const config = await getScimConfig();
  return config.enabled && config.token.length > 0;
}

// Constant-time comparison, so a wrong token cannot be recovered by timing the
// answer. Lengths are compared first because timingSafeEqual rejects buffers of
// different sizes.
export async function verifyScimToken(candidate: string): Promise<boolean> {
  const config = await getScimConfig();
  if (!config.enabled || config.token.length === 0) return false;
  const expected = Buffer.from(config.token);
  const given = Buffer.from(candidate);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// ── Invites ───────────────────────────────────────────────────────────────────

// True when this address has a pending project invite. That is what "invite only"
// means on this instance: an owner invites someone to a project, and that invite is
// what lets them register at all. Invites are created and revoked inside a project
// (project_invite), so there is nothing instance-level to manage.
//
// The invite itself is accepted after sign-up, on the /invite/:token screen — this
// only decides whether the account may be created, and leaves the invite pending.
export async function hasPendingInvite(email: string): Promise<boolean> {
  const address = email.trim().toLowerCase();
  if (!address) return false;
  const rows = await db
    .select({ id: projectInvite.id })
    .from(projectInvite)
    .where(and(eq(projectInvite.email, address), eq(projectInvite.status, 'pending')))
    .limit(1);
  return rows.length > 0;
}
