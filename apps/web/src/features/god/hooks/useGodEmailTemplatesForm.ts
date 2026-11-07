'use client';

import { useMemo, useState } from 'react';
import type { Locale } from '@/i18n/locales';
import type {
  EmailDraft,
  EmailLayout,
  EmailTemplateEntry,
  EmailTemplatesBody,
  EmailTemplatesSettings,
  EmailText,
} from '@/lib/api/endpoints/god';
import { useUpdateEmailTemplates } from '../services/god.service';
import { unknownVariables, writtenText } from '../utils/emailMarkdown';

export interface EmailSelection {
  key: string;
  locale: Locale;
  tab: 'emails' | 'layout';
}

type EmailEdits = EmailTemplatesBody['edits'];

export interface GodEmailTemplatesForm {
  settings: EmailTemplatesSettings;
  template: (key: string) => EmailTemplateEntry;
  text: (key: string, locale: string) => EmailText;
  isEdited: (key: string, locale: string) => boolean;
  setText: (key: string, locale: string, text: EmailText) => void;
  resetText: (key: string, locale: string) => void;
  layout: EmailLayout;
  setLayout: (layout: EmailLayout) => void;
  resetLayout: () => void;
  layoutEdited: boolean;
  missingPlaceholders: string[];
  unknownPlaceholders: string[];
  hasBlankText: boolean;
  hasUnknownVariables: boolean;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
  draft: (key: string, locale: string) => EmailDraft;
}

function sameText(a: EmailText, b: EmailText): boolean {
  return a.subject === b.subject && a.body === b.body && a.button === b.button;
}

function sameLayout(a: EmailLayout, b: EmailLayout): boolean {
  return a.html === b.html && a.css === b.css;
}

function fingerprint(edits: EmailEdits): string {
  return Object.entries(edits)
    .flatMap(([key, byLocale]) =>
      Object.entries(byLocale).map(([locale, text]) => JSON.stringify([key, locale, text])),
    )
    .sort()
    .join('\n');
}

// All the edits of the page, across emails and languages, saved at once. A text that matches
// the built-in one holds no edit, so a language shows as edited only while it differs.
export function useGodEmailTemplatesForm(settings: EmailTemplatesSettings): GodEmailTemplatesForm {
  const update = useUpdateEmailTemplates();
  const saved = useMemo(
    () => Object.fromEntries(settings.templates.map((entry) => [entry.key, entry.edits])),
    [settings],
  );
  const [edits, setEdits] = useState<EmailEdits>(saved);
  const [layout, setLayout] = useState(settings.layout);

  const template = (key: string) =>
    settings.templates.find((entry) => entry.key === key) ?? settings.templates[0];
  const text = (key: string, locale: string) =>
    edits[key]?.[locale] ?? template(key).defaults[locale];

  function resetText(key: string, locale: string) {
    setEdits((current) => {
      const { [locale]: _removed, ...rest } = current[key] ?? {};
      return { ...current, [key]: rest };
    });
  }

  function setText(key: string, locale: string, next: EmailText) {
    if (sameText(next, template(key).defaults[locale])) {
      resetText(key, locale);
      return;
    }
    setEdits((current) => ({ ...current, [key]: { ...current[key], [locale]: next } }));
  }

  const layoutEdited = !sameLayout(layout, settings.defaultLayout);
  const unknownPlaceholders = unknownVariables(
    layout.html,
    settings.placeholders.map((placeholder) => placeholder.name),
  );

  return {
    settings,
    template,
    text,
    isEdited: (key, locale) => Boolean(edits[key]?.[locale]),
    setText,
    resetText,
    layout,
    setLayout,
    resetLayout: () => setLayout(settings.defaultLayout),
    layoutEdited,
    missingPlaceholders: settings.placeholders
      .filter((p) => p.required && !layout.html.includes(`{${p.name}}`))
      .map((p) => p.name),
    unknownPlaceholders,
    hasBlankText: Object.values(edits)
      .flatMap((byLocale) => Object.values(byLocale))
      .some((entry) => !entry.subject.trim() || !entry.body.trim()),
    hasUnknownVariables:
      unknownPlaceholders.length > 0 ||
      Object.entries(edits).some(([key, byLocale]) =>
        Object.values(byLocale).some(
          (entry) => unknownVariables(writtenText(entry), template(key).variables).length > 0,
        ),
      ),
    dirty: fingerprint(edits) !== fingerprint(saved) || !sameLayout(layout, settings.layout),
    saving: update.isPending,
    save: async () => {
      await update.mutateAsync({ edits, layout: layoutEdited ? layout : null });
    },
    draft: (key, locale) => ({ key, locale, text: text(key, locale), layout }),
  };
}
