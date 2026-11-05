import { LOCALES, type Locale } from '../locale';
import type { CoreEmailKey, EmailLocaleTexts, EmailText, EmailWords } from './types';
import { ar } from './texts/ar';
import { en } from './texts/en';
import { esES } from './texts/es-ES';
import { fa } from './texts/fa';
import { fr } from './texts/fr';
import { id } from './texts/id';
import { ko } from './texts/ko';
import { ptBR } from './texts/pt-BR';
import { ru } from './texts/ru';
import { tr } from './texts/tr';
import { uk } from './texts/uk';
import { zhCN } from './texts/zh-CN';
import { zhTW } from './texts/zh-TW';

const LOCALE_TEXTS: Record<Locale, EmailLocaleTexts> = {
  en,
  uk,
  ru,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ar,
  fa,
  fr,
  'pt-BR': ptBR,
  id,
  'es-ES': esES,
  ko,
  tr,
};

// What makes an email editable in god mode. The god mode page reads its name and its group's
// from the messages `god.emailTemplates.templates.<key>` and `.groups.<group>`.
export interface EmailTemplate {
  key: string;
  group: string;
  // The {names} its text may use, with the value each one has in the preview.
  samples: Record<string, string>;
  // Where its link goes in the preview. Null for an email with no link and no button.
  samplePath: string | null;
  // English is required. A language with no text of its own sends the English one.
  texts: { en: EmailText } & Partial<Record<Locale, EmailText>>;
}

const ISSUE = { actor: 'Maria Lopez', ref: 'WEB-42', title: 'Fix the login redirect' };
const DOCUMENT = { actor: 'Maria Lopez', document: 'Q3 launch plan' };

function core(
  key: CoreEmailKey,
  group: string,
  samples: Record<string, string>,
  samplePath: string | null,
): EmailTemplate {
  const texts = Object.fromEntries(LOCALES.map((l) => [l, LOCALE_TEXTS[l].templates[key]]));
  return { key, group, samples, samplePath, texts: texts as EmailTemplate['texts'] };
}

const CORE_TEMPLATES: EmailTemplate[] = [
  core('reset', 'signIn', {}, '/reset-password?token=example'),
  core('verify', 'signIn', {}, '/verify-email?token=example'),
  core('magic', 'signIn', {}, '/magic-link?token=example'),
  core(
    'inviteProject',
    'invitations',
    { inviter: 'Maria Lopez', project: 'Website redesign', role: 'member' },
    '/invite/example',
  ),
  core(
    'inviteTeam',
    'invitations',
    { inviter: 'Maria Lopez', team: 'Acme', role: 'member' },
    '/invite/example',
  ),
  core('assigned', 'notifications', ISSUE, '/acme/WEB/issue/42'),
  core('mentioned', 'notifications', ISSUE, '/acme/WEB/issue/42'),
  core('commented', 'notifications', ISSUE, '/acme/WEB/issue/42#comment-7'),
  core(
    'stateChanged',
    'notifications',
    { ...ISSUE, from: 'In progress', to: 'Done' },
    '/acme/WEB/issue/42',
  ),
  core('documentMentioned', 'notifications', DOCUMENT, '/acme/WEB/documents/7'),
  core('documentCommentMentioned', 'notifications', DOCUMENT, '/acme/WEB/documents/7'),
  core('test', 'service', {}, null),
];

let templates = CORE_TEMPLATES;

// The templates of an edition's own emails, beside the core's: they get the god mode editor,
// the layout and the languages as they are, and go out through composeEmail in @repo/auth.
// Each call replaces the previous ones; a key already taken throws and the previous set
// stays. What god saved for a template that goes away stays stored.
export function setExtraEmailTemplates(extra: EmailTemplate[]): void {
  const next = [...CORE_TEMPLATES, ...extra];
  const keys = new Set<string>();
  for (const { key } of next) {
    if (keys.has(key)) throw new Error(`Duplicate email template key "${key}".`);
    keys.add(key);
  }
  templates = next;
}

export function emailTemplates(): EmailTemplate[] {
  return templates;
}

export function emailTemplate(key: string): EmailTemplate | undefined {
  return templates.find((template) => template.key === key);
}

export function defaultEmailText(template: EmailTemplate, locale: Locale): EmailText {
  return template.texts[locale] ?? template.texts.en;
}

export function emailLinkHint(locale: Locale): string {
  return LOCALE_TEXTS[locale].linkHint;
}

export function emailWords(locale: Locale): EmailWords {
  return LOCALE_TEXTS[locale].words;
}
