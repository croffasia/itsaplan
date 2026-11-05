'use client';

import { useTranslations } from 'next-intl';
import { byKey } from '@/utils/messageKey';
import GodEmailPlaceholderList from './GodEmailPlaceholderList';

export default function GodEmailVariables({
  variables,
  written,
  onInsert,
}: {
  variables: string[];
  written: string;
  onInsert: (name: string) => void;
}) {
  const t = useTranslations('god.emailTemplates');
  const describe = byKey(t);
  if (variables.length === 0) return null;

  return (
    <GodEmailPlaceholderList
      title={t('variables')}
      items={variables.map((name) => {
        const path = `variableText.${name}`;
        return {
          name,
          // An edition's email may bring a variable with no description.
          description: t.has(path as never) ? describe(path) : null,
          used: written.includes(`{${name}}`),
        };
      })}
      onInsert={onInsert}
    />
  );
}
