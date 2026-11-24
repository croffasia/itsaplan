'use client';

import { useTranslations } from 'next-intl';
import { LOCALES, LOCALE_LABELS } from '@/i18n/locales';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import GodEmailEditedDot from './GodEmailEditedDot';
import type { EmailSelection, GodEmailTemplatesForm } from '../../hooks/useGodEmailTemplatesForm';

export default function GodEmailLocalePicker({
  form,
  selection,
  onSelect,
}: {
  form: GodEmailTemplatesForm;
  selection: EmailSelection;
  onSelect: (patch: Partial<EmailSelection>) => void;
}) {
  const t = useTranslations('god.emailTemplates');
  const tCommon = useTranslations('common');

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="text-[13px] font-medium">{tCommon('language')}</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-[7px] rounded-full bg-foreground" />
          {t('edited')}
        </span>
      </div>
      <div role="group" aria-label={tCommon('language')} className="flex flex-wrap gap-1.5">
        {LOCALES.map((locale) => (
          <Button
            key={locale}
            variant="outline"
            size="sm"
            aria-pressed={locale === selection.locale}
            className={cn(
              'h-7 text-xs',
              locale === selection.locale && 'border-foreground bg-secondary',
            )}
            onClick={() => onSelect({ locale })}
          >
            {form.isEdited(selection.key, locale) && <GodEmailEditedDot />}
            {LOCALE_LABELS[locale]}
          </Button>
        ))}
      </div>
    </div>
  );
}
