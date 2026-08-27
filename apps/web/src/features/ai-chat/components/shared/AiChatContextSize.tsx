'use client';

import { useFormatter, useTranslations } from 'next-intl';

// How large the conversation's context is after its last completed answer, which is
// what says how close it is to the agent's limit. Null where the agent reports no
// counts that can be read as a context size.
export function AiChatContextSize({ tokens }: { tokens: number | null }) {
  const t = useTranslations('aiChat');
  const format = useFormatter();

  if (tokens === null) {
    return (
      <span className="text-xs text-muted-foreground" title={t('contextUnavailable')}>
        —
      </span>
    );
  }
  return (
    <span
      className="text-xs text-muted-foreground"
      title={t('contextSizeHint', { tokens: format.number(tokens) })}
      dir="ltr"
    >
      {t('contextSize', { tokens: compact(tokens) })}
    </span>
  );
}

// Thousands as "48.2k", so the number stays the same width as the conversation grows.
function compact(tokens: number): string {
  return tokens < 1000 ? String(tokens) : `${(tokens / 1000).toFixed(1)}k`;
}
