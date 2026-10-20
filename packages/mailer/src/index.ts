import nodemailer from 'nodemailer';

// Outbound email transport, shared by the two senders in the app: project
// notifications (credentials per project) and authentication mail (credentials per
// instance). Only the transport lives here. Where the credentials come from, how
// they are stored, and what the message says belong to the caller.

const HTTP_TIMEOUT_MS = 15_000;

// Microsoft 365 refuses a password once the mailbox has MFA, and is retiring password
// SMTP altogether. 'microsoft365' signs in as an app registration (client credentials,
// permission SMTP.SendAsApp) and presents the token over XOAUTH2 as `username`.
export type SmtpAuth = 'password' | 'microsoft365';

export interface MicrosoftOAuthConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number | null;
  encryption: 'none' | 'ssl' | 'tls';
  username: string;
  password: string;
  timeout: number | null;
  // Absent on configs stored before it existed: those are password ones.
  auth?: SmtpAuth;
  oauth?: MicrosoftOAuthConfig;
}

export interface ResendConfig {
  enabled: boolean;
  apiKey: string;
}

export interface EmailConfig {
  smtp: SmtpConfig;
  resend: ResendConfig;
  // The From address. Falls back to EMAIL_FROM, then to the SMTP username.
  from?: string | null;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey?: string;
}

export interface SendResult {
  ok: boolean;
  // Only meaningful when ok is false: true for a transient failure worth retrying
  // (network error, timeout, rate limit, server error), false for a permanent one
  // (bad credentials, rejected recipient, misconfiguration).
  retryable?: boolean;
  error?: string;
}

// The From address for outbound email. An explicit config value wins, then the
// EMAIL_FROM env var; for SMTP the username (usually the account's own address) is
// the last fallback. Resend has no natural fallback: it needs a verified sender.
function fromAddress(config: EmailConfig, provider: 'smtp' | 'resend'): string | null {
  if (config.from && config.from.length > 0) return config.from;
  const env = process.env.EMAIL_FROM ?? process.env.NOTIFICATIONS_EMAIL_FROM;
  if (env && env.length > 0) return env;
  if (provider === 'smtp' && config.smtp.username.length > 0) return config.smtp.username;
  return null;
}

class TokenError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

// A token lasts about an hour; reusing it spares Microsoft a sign-in per message.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const TOKEN_MARGIN_MS = 60_000;

async function microsoftAccessToken(oauth: MicrosoftOAuthConfig): Promise<string> {
  const key = `${oauth.tenantId}|${oauth.clientId}|${oauth.clientSecret}`;
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt - TOKEN_MARGIN_MS > Date.now()) return cached.token;

  let res: Response;
  try {
    res = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(oauth.tenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: oauth.clientId,
          client_secret: oauth.clientSecret,
          scope: 'https://outlook.office365.com/.default',
        }),
      },
    );
  } catch (err) {
    throw new TokenError(
      err instanceof Error ? err.message : 'microsoft token request failed',
      true,
    );
  }
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    const retryable = res.status >= 500 || res.status === 429;
    // A 4xx is a wrong tenant, client or secret, or a missing grant: retrying will not fix it.
    const reason = retryable
      ? 'microsoft token request failed'
      : 'microsoft refused the credentials';
    throw new TokenError(
      `${reason} (${res.status}): ${body.error_description ?? 'no description'}`,
      retryable,
    );
  }
  tokenCache.set(key, {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  });
  return body.access_token;
}

async function smtpAuth(smtp: SmtpConfig) {
  if (smtp.auth === 'microsoft365') {
    if (!smtp.oauth) throw new TokenError('microsoft 365 app credentials are missing', false);
    return {
      type: 'OAuth2' as const,
      user: smtp.username,
      accessToken: await microsoftAccessToken(smtp.oauth),
    };
  }
  return smtp.username ? { user: smtp.username, pass: smtp.password } : undefined;
}

async function sendSmtp(
  smtp: SmtpConfig,
  message: EmailMessage,
  from: string,
): Promise<SendResult> {
  // The config stores the timeout in seconds, nodemailer takes milliseconds.
  const timeoutMs = smtp.timeout ? smtp.timeout * 1000 : undefined;
  let auth: Awaited<ReturnType<typeof smtpAuth>>;
  try {
    auth = await smtpAuth(smtp);
  } catch (err) {
    const retryable = err instanceof TokenError ? err.retryable : true;
    return { ok: false, retryable, error: err instanceof Error ? err.message : 'smtp auth failed' };
  }
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port ?? (smtp.encryption === 'ssl' ? 465 : 587),
    secure: smtp.encryption === 'ssl',
    requireTLS: smtp.encryption === 'tls',
    auth,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  });
  try {
    await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { ok: true };
  } catch (err) {
    // SMTP 5xx is a permanent rejection; a 4xx code, connection error, or timeout is
    // transient and worth retrying.
    const code = (err as { responseCode?: number }).responseCode;
    const retryable = !(typeof code === 'number' && code >= 500 && code < 600);
    return { ok: false, retryable, error: err instanceof Error ? err.message : 'smtp send failed' };
  }
}

async function sendResend(
  resend: ResendConfig,
  message: EmailMessage,
  from: string,
): Promise<SendResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${resend.apiKey}`,
        'content-type': 'application/json',
        ...(message.idempotencyKey ? { 'idempotency-key': message.idempotencyKey } : {}),
      },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (res.ok) return { ok: true };
    const body = await res.text().catch(() => '');
    return {
      ok: false,
      retryable: res.status === 429 || res.status >= 500,
      error: `Resend HTTP ${res.status}: ${body.slice(0, 200)}`,
    };
  } catch (err) {
    return {
      ok: false,
      retryable: true,
      error: err instanceof Error ? err.message : 'resend request failed',
    };
  }
}

// True when the config has a usable provider. Callers use it to disable features
// that depend on outbound email instead of queuing mail that cannot be sent.
export function hasEmailProvider(config: EmailConfig): boolean {
  return (
    (config.smtp.enabled && config.smtp.host.length > 0) ||
    (config.resend.enabled && config.resend.apiKey.length > 0)
  );
}

// Sends one message with the first enabled provider: SMTP wins over Resend when
// both are on.
export async function sendEmail(config: EmailConfig, message: EmailMessage): Promise<SendResult> {
  if (!message.to) return { ok: false, retryable: false, error: 'no recipient' };
  const { smtp, resend } = config;
  if (smtp.enabled && smtp.host.length > 0) {
    const from = fromAddress(config, 'smtp');
    if (!from) return { ok: false, retryable: false, error: 'no From address for SMTP' };
    return sendSmtp(smtp, message, from);
  }
  if (resend.enabled && resend.apiKey.length > 0) {
    const from = fromAddress(config, 'resend');
    if (!from) return { ok: false, retryable: false, error: 'EMAIL_FROM is required for Resend' };
    return sendResend(resend, message, from);
  }
  return { ok: false, retryable: false, error: 'no email provider enabled' };
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Wraps a plain-text body (and an optional link) into the text/html pair the
// transport needs. Shared so every message in the app looks the same.
export function emailBody(text: string, url?: string | null): { text: string; html: string } {
  const plain = url ? `${text}\n\n${url}` : text;
  const body = escape(text).replace(/\n/g, '<br>');
  const link = url ? `<p><a href="${escape(url)}">${escape(url)}</a></p>` : '';
  return { text: plain, html: `<p>${body}</p>${link}` };
}
