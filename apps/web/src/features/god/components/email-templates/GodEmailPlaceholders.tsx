'use client';

import { useTranslations } from 'next-intl';
import { byKey } from '@/utils/messageKey';
import GodEmailPlaceholderList from './GodEmailPlaceholderList';
import type { GodEmailTemplatesForm } from '../../hooks/useGodEmailTemplatesForm';

export default function GodEmailPlaceholders({
  form,
  onInsert,
}: {
  form: GodEmailTemplatesForm;
  onInsert: (name: string) => void;
}) {
  const t = useTranslations('god.emailTemplates');
  const describe = byKey(t);

  return (
    <GodEmailPlaceholderList
      title={t('placeholders')}
      items={form.settings.placeholders.map(({ name }) => ({
        name,
        description: describe(`placeholderText.${name}`),
        used: form.layout.html.includes(`{${name}}`),
        missing: form.missingPlaceholders.includes(name),
      }))}
      onInsert={onInsert}
    />
  );
}
