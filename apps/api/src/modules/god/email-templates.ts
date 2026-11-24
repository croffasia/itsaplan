import {
  composeEmailDraft,
  getEmailTemplateSettings,
  setEmailTemplateSettings,
  type EmailTemplateSettings,
} from '@repo/auth';
import { getInstanceEmailConfig, hasConfiguredEmailProvider } from '@repo/db';
import {
  DEFAULT_EMAIL_LAYOUT,
  LAYOUT_PLACEHOLDERS,
  LOCALES,
  defaultEmailText,
  emailTemplate,
  emailTemplates,
  hasEmailProvider,
  isLocale,
  missingLayoutPlaceholders,
  senderAddress,
  unknownEmailVariables,
  unknownLayoutPlaceholders,
} from '@repo/mailer';
import { HttpError } from '#shared/lib';
import { deliverTestEmail } from './email-test';
import type { EmailDraftBody, EmailTemplatesBody } from './model';

type EmailTemplatesInput = typeof EmailTemplatesBody.static;
type EmailDraft = typeof EmailDraftBody.static;

function nameList(names: string[]): string {
  return names.map((name) => `{${name}}`).join(', ');
}

export async function getEmailTemplates() {
  const settings = await getEmailTemplateSettings();
  return {
    templates: emailTemplates().map((template) => ({
      key: template.key,
      group: template.group,
      variables: Object.keys(template.samples),
      hasLink: template.samplePath !== null,
      defaults: Object.fromEntries(
        LOCALES.map((locale) => [locale, defaultEmailText(template, locale)]),
      ),
      edits: settings.texts[template.key] ?? {},
    })),
    layout: settings.layout ?? DEFAULT_EMAIL_LAYOUT,
    defaultLayout: DEFAULT_EMAIL_LAYOUT,
    placeholders: LAYOUT_PLACEHOLDERS,
    canSend: await hasConfiguredEmailProvider(),
  };
}

function assertEdits(edits: EmailTemplatesInput['edits']): void {
  for (const [key, byLocale] of Object.entries(edits)) {
    const template = emailTemplate(key);
    if (!template) throw new HttpError(400, `Unknown email template: ${key}`);
    for (const [locale, text] of Object.entries(byLocale)) {
      if (!isLocale(locale)) throw new HttpError(400, `Unknown language: ${locale}`);
      if (!text.subject.trim() || !text.body.trim()) {
        throw new HttpError(400, 'An email needs a subject and a text');
      }
      const unknown = unknownEmailVariables(text, Object.keys(template.samples));
      if (unknown.length > 0) {
        throw new HttpError(400, `Unknown variables in ${key} (${locale}): ${nameList(unknown)}`);
      }
    }
  }
}

function assertLayout(html: string): void {
  const missing = missingLayoutPlaceholders(html);
  if (missing.length > 0) throw new HttpError(400, `The layout needs ${nameList(missing)}`);
  const unknown = unknownLayoutPlaceholders(html);
  if (unknown.length > 0) {
    throw new HttpError(400, `Unknown variables in the layout: ${nameList(unknown)}`);
  }
}

// A template that is not there right now, such as an edition's while it is off, keeps what
// god saved for it.
export async function saveEmailTemplates(body: EmailTemplatesInput) {
  assertEdits(body.edits);
  if (body.layout) assertLayout(body.layout.html);
  const stored = await getEmailTemplateSettings();
  const kept = Object.entries(stored.texts).filter(([key]) => !emailTemplate(key));
  const next: EmailTemplateSettings = {
    texts: { ...Object.fromEntries(kept), ...body.edits },
    layout: body.layout,
  };
  await setEmailTemplateSettings(next);
  return getEmailTemplates();
}

function renderDraft(draft: EmailDraft) {
  const template = emailTemplate(draft.key);
  if (!template) throw new HttpError(400, `Unknown email template: ${draft.key}`);
  return composeEmailDraft(template, draft);
}

export async function previewEmail(draft: EmailDraft) {
  const config = await getInstanceEmailConfig();
  return { ...renderDraft(draft), from: config ? senderAddress(config) : null };
}

export async function sendTestEmail(recipient: string, draft: EmailDraft) {
  const config = await getInstanceEmailConfig();
  if (!config || !hasEmailProvider(config)) {
    throw new HttpError(400, 'Configure an email provider first');
  }
  await deliverTestEmail(config, { to: recipient, ...renderDraft(draft) });
  return { recipient };
}
