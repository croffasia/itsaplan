'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { localeDirection, LOCALE_LABELS } from '@/i18n/locales';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GodEmailFrame from './GodEmailFrame';
import GodEmailPreviewMeta from './GodEmailPreviewMeta';
import { useGodEmailTemplateText } from '../../hooks/useGodEmailTemplateText';
import { useEmailPreviewQuery } from '../../services/god.service';
import type { EmailSelection, GodEmailTemplatesForm } from '../../hooks/useGodEmailTemplatesForm';

export default function GodEmailPreview({
  form,
  selection,
}: {
  form: GodEmailTemplatesForm;
  selection: EmailSelection;
}) {
  const t = useTranslations('god.emailTemplates');
  const text = useGodEmailTemplateText();
  const [view, setView] = useState<'email' | 'text'>('email');
  const { key, locale, tab } = selection;
  const emailText = form.text(key, locale);
  const { layout } = form;
  const draft = useMemo(
    () => ({ key, locale, text: emailText, layout }),
    [key, locale, emailText, layout],
  );
  const preview = useEmailPreviewQuery(useDebouncedValue(draft, 400));
  const email = preview.data;
  const dir = localeDirection(locale);

  return (
    <aside
      aria-label={t('preview')}
      className="flex min-w-0 flex-col gap-3 rounded-xl bg-muted p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] font-medium">{t('preview')}</span>
        <Tabs value={view} onValueChange={(value) => setView(value as 'email' | 'text')}>
          <TabsList className="h-8">
            <TabsTrigger value="email">{t('previewEmail')}</TabsTrigger>
            <TabsTrigger value="text">{t('previewText')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="overflow-hidden rounded-lg bg-white text-[#1c1c1c] shadow-md">
        {preview.isError && <p className="p-5 text-sm text-destructive">{t('previewFailed')}</p>}
        {!preview.isError && !email && <Skeleton className="m-5 h-40" />}
        {!preview.isError && email && (
          <>
            <GodEmailPreviewMeta email={email} dir={dir} />
            {view === 'email' ? (
              <GodEmailFrame html={email.html} />
            ) : (
              <pre
                dir={dir}
                className="p-5 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap"
              >
                {email.text}
              </pre>
            )}
          </>
        )}
      </div>
      {tab === 'layout' && (
        <p className="text-xs text-muted-foreground">
          {text.name(key)} · {LOCALE_LABELS[locale]}
        </p>
      )}
    </aside>
  );
}
