import {
  DEFAULT_EMAIL_LAYOUT,
  defaultEmailText,
  emailTemplate,
  isLocale,
  localeFromAcceptLanguage,
  renderEmail,
  sendEmail,
  type CoreEmailKey,
  type EmailLayout,
  type EmailSite,
  type EmailTemplate,
  type EmailText,
  type Locale,
  type RenderedEmail,
} from '@repo/mailer';
import { db, getInstanceEmailConfig, user, userPreference } from '@repo/db';
import { eq, inArray } from 'drizzle-orm';
import { getEmailTemplateSettings } from './instance';
import { trustedOrigins } from './origins';

function emailSite(): EmailSite {
  const url = trustedOrigins[0];
  return { name: "It's a Plan", url, logoUrl: `${url}/icon-192.png` };
}

export async function composeEmail(
  key: string,
  locale: Locale,
  vars: Record<string, string> = {},
  url?: string,
): Promise<RenderedEmail> {
  const template = emailTemplate(key);
  if (!template) throw new Error(`Unknown email template "${key}".`);
  const settings = await getEmailTemplateSettings();
  return renderEmail({
    text: settings.texts[key]?.[locale] ?? defaultEmailText(template, locale),
    layout: settings.layout ?? DEFAULT_EMAIL_LAYOUT,
    locale,
    vars,
    url,
    site: emailSite(),
  });
}

export function composeEmailDraft(
  template: EmailTemplate,
  draft: { locale: Locale; text: EmailText; layout: EmailLayout },
): RenderedEmail {
  const site = emailSite();
  return renderEmail({
    ...draft,
    vars: template.samples,
    url: template.samplePath && new URL(template.samplePath, site.url).toString(),
    site,
  });
}

// The language each account saved. An account that has not opened the app yet has no row.
export async function savedLocales(userIds: string[]): Promise<Map<string, Locale>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: userPreference.userId, locale: userPreference.locale })
    .from(userPreference)
    .where(inArray(userPreference.userId, userIds));
  const locales = new Map<string, Locale>();
  for (const row of rows) {
    if (isLocale(row.locale)) locales.set(row.userId, row.locale);
  }
  return locales;
}

export async function savedLocaleOf(email: string): Promise<Locale | null> {
  const [row] = await db
    .select({ locale: userPreference.locale })
    .from(userPreference)
    .innerJoin(user, eq(user.id, userPreference.userId))
    .where(eq(user.email, email.toLowerCase()));
  return isLocale(row?.locale) ? row.locale : null;
}

// The language an address chose, or the language of the browser asking when it has none yet:
// someone signing up or an address with no account.
export async function emailLocale(email: string, request?: Request): Promise<Locale> {
  const saved = await savedLocaleOf(email);
  return saved ?? localeFromAcceptLanguage(request?.headers.get('accept-language') ?? null);
}

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
  template: CoreEmailKey;
  locale: Locale;
  url: string;
}): Promise<boolean> {
  const config = await getInstanceEmailConfig();
  if (!config) {
    console.warn('[auth] no email provider configured, dropping mail:', input.template);
    return false;
  }
  const email = await composeEmail(input.template, input.locale, {}, input.url);
  const result = await sendEmail(config, { to: input.to, ...email });
  if (!result.ok) console.error('[auth] email send failed:', result.error);
  return result.ok;
}
