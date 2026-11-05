'use client';

import { useTranslations } from 'next-intl';
import { byKey } from '@/utils/messageKey';

// The names in the email list. A template is known by a key from the api, and an edition
// adds its own with its messages, so the message key is built at runtime.
export function useGodEmailTemplateText() {
  const t = useTranslations('god.emailTemplates');
  const read = byKey(t);
  return {
    name: (key: string) => read(`templates.${key}.name`),
    hint: (key: string) => {
      const path = `templates.${key}.hint`;
      return t.has(path as never) ? read(path) : null;
    },
    group: (group: string) => read(`groups.${group}`),
  };
}
