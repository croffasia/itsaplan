import { sendEmail, emailBody, type EmailConfig, type SendResult } from '@repo/mailer';
import { getProjectEmailConfig } from '@repo/auth';
import { emailSource, type NotificationConfig } from '../notification-settings/store';
import type { DeliveryPayload } from './outbound';
import { getInstanceBotConfig, isInstanceBotUsable } from '../telegram/store';

// Sends one composed notification over the requested channel using the project's
// decrypted config. Email transport lives in @repo/mailer (shared with the
// authentication mail sent from @repo/auth); Telegram is only used here, so it stays
// in this file. A project that set no bot token of its own sends through the instance
// bot, the same one members link their Telegram accounts through. Adding a channel is
// a new branch here plus a compose function in outbound.ts; nothing else changes. The
// result tells the worker whether a failure is worth retrying (transient: network
// error, timeout, rate limit, server error) or permanent (bad credentials, rejected
// recipient, misconfiguration).

export type { SendResult };

export interface SendInput {
  channel: 'email' | 'telegram';
  recipient: string | null;
  payload: DeliveryPayload;
  config: NotificationConfig;
}

async function sendNotificationEmail(input: SendInput): Promise<SendResult> {
  if (!input.recipient) return { ok: false, retryable: false, error: 'no recipient' };
  // The project's own provider when it configured one, otherwise the instance
  // provider (which carries its own From address). A project set to the instance
  // provider stops sending when the administrator withdraws it.
  const source = emailSource(input.config);
  const config: EmailConfig | null =
    source === 'system'
      ? await getProjectEmailConfig()
      : source === 'none'
        ? null
        : { smtp: input.config.smtp, resend: input.config.resend };
  if (!config) return { ok: false, retryable: false, error: 'email not configured' };
  const { text, html } = emailBody(input.payload.text, input.payload.url);
  return sendEmail(config, {
    to: input.recipient,
    subject: input.payload.subject ?? '',
    text,
    html,
  });
}

async function sendTelegram(input: SendInput): Promise<SendResult> {
  const { telegram } = input.config;
  if (!telegram.enabled) {
    return { ok: false, retryable: false, error: 'telegram not configured' };
  }
  // The project's own bot when it set one, otherwise the instance bot the members
  // linked their accounts through.
  const instance = telegram.botToken ? null : await getInstanceBotConfig();
  const botToken =
    telegram.botToken || (instance && isInstanceBotUsable(instance) ? instance.botToken : '');
  if (!botToken) return { ok: false, retryable: false, error: 'telegram not configured' };
  if (!input.recipient) return { ok: false, retryable: false, error: 'no chat id' };
  const chatId = input.recipient;
  // Prefer the HTML body (clickable issue link, formatting); fall back to plain text
  // with the link appended on its own blank line when a row carries no HTML. The
  // payload text never contains the URL itself, so it is added exactly once here.
  const useHtml = Boolean(input.payload.html);
  const text = useHtml
    ? input.payload.html!
    : input.payload.url
      ? `${input.payload.text}\n\n${input.payload.url}`
      : input.payload.text;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(useHtml ? { parse_mode: 'HTML' } : {}),
        link_preview_options: { is_disabled: true },
      }),
    });
    if (res.ok) return { ok: true };
    const body = await res.text().catch(() => '');
    // A 429 or 5xx is transient; other 4xx (bad token, chat not found) is permanent.
    return {
      ok: false,
      retryable: res.status === 429 || res.status >= 500,
      error: `Telegram HTTP ${res.status}: ${body.slice(0, 200)}`,
    };
  } catch (err) {
    return {
      ok: false,
      retryable: true,
      error: err instanceof Error ? err.message : 'telegram request failed',
    };
  }
}

export async function sendDelivery(input: SendInput): Promise<SendResult> {
  if (input.channel === 'email') return sendNotificationEmail(input);
  if (input.channel === 'telegram') return sendTelegram(input);
  return { ok: false, retryable: false, error: `unknown channel: ${input.channel as string}` };
}
