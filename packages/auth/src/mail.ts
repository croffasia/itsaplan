import { sendEmail, emailBody } from '@repo/mailer';
import { getEmailConfig } from './instance';

// Authentication email: password reset, address verification, magic link. It uses
// the instance mail provider configured in god mode, which is separate from the
// per-project notification providers.
//
// Delivery is best effort and never blocks the request that triggered it: when no
// provider is configured, or the provider rejects the message, this logs and
// returns false. The caller keeps working — a reset link that cannot be delivered
// must not turn into a failed sign-in flow that leaks whether an account exists.
export async function sendAuthEmail(input: {
  to: string;
  subject: string;
  text: string;
  url?: string;
}): Promise<boolean> {
  const config = await getEmailConfig();
  if (!config) {
    console.warn('[auth] no email provider configured, dropping mail:', input.subject);
    return false;
  }
  const { text, html } = emailBody(input.text, input.url);
  const result = await sendEmail(config, {
    to: input.to,
    subject: input.subject,
    text,
    html,
  });
  if (!result.ok) console.error('[auth] email send failed:', result.error);
  return result.ok;
}
