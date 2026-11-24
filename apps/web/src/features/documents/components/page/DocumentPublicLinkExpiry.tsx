'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ShareState } from '@/lib/api/endpoints/share';
import { Button } from '@/components/ui/button';
import DatePill from '@/components/common/fields/DatePill';
import { toDateStr } from '@/utils/dates';

type Choice = 'never' | '1' | '3' | '7' | 'date';

const PRESETS = [1, 3, 7] as const;

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

// A link set to expire on a picked day works through the end of that day.
function endOfDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59).toISOString();
}

export default function DocumentPublicLinkExpiry({
  expiresAt,
  disabled,
  onChange,
}: {
  expiresAt: string | null;
  disabled: boolean;
  onChange: (expiresAt: string | null) => Promise<ShareState>;
}) {
  const t = useTranslations('documents');
  const format = useFormatter();
  // The API keeps the expiry, not the preset that set it: a preset stays pressed while the
  // expiry it saved is the current one.
  const [preset, setPreset] = useState<{ choice: Choice; expiresAt: string | null } | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [date, setDate] = useState(() => (expiresAt ? toDateStr(new Date(expiresAt)) : ''));
  let choice: Choice = expiresAt ? 'date' : 'never';
  if (preset?.expiresAt === expiresAt) choice = preset.choice;

  function save(next: Choice, value: string | null) {
    setDateOpen(false);
    onChange(value)
      .then((state) => setPreset({ choice: next, expiresAt: state.expiresAt }))
      .catch(() => undefined);
  }

  const options: { choice: Choice; label: string }[] = [
    { choice: 'never', label: t('publicLink.never') },
    ...PRESETS.map((days) => ({
      choice: String(days) as Choice,
      label: t('publicLink.days', { count: days }),
    })),
    { choice: 'date', label: t('publicLink.pickDate') },
  ];

  return (
    <div className="-mx-1.5 flex flex-col gap-2 px-1.5 py-2">
      <span>
        <span className="block text-sm font-medium">{t('publicLink.expires')}</span>
        {expiresAt && (
          <span className="block text-xs leading-[1.45] text-muted-foreground">
            {t('publicLink.worksThrough', {
              date: format.dateTime(new Date(expiresAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
          </span>
        )}
      </span>
      <div
        role="group"
        aria-label={t('publicLink.expires')}
        className="flex flex-wrap gap-0.5 self-start rounded-md bg-muted/80 p-0.5"
      >
        {options.map((option) => (
          <button
            key={option.choice}
            type="button"
            disabled={disabled}
            aria-pressed={
              option.choice === 'date'
                ? dateOpen || choice === 'date'
                : !dateOpen && choice === option.choice
            }
            onClick={() => {
              if (option.choice === 'date') setDateOpen(true);
              else if (option.choice === 'never') save('never', null);
              else save(option.choice, inDays(Number(option.choice)));
            }}
            className="inline-flex h-6 items-center rounded-sm px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs"
          >
            {option.label}
          </button>
        ))}
      </div>
      {dateOpen && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (date) save('date', endOfDay(date));
          }}
        >
          <DatePill
            value={date || null}
            placeholder={t('publicLink.expiryDate')}
            clearable={false}
            disabled={{ before: new Date() }}
            onChange={(value) => setDate(value ?? '')}
          />
          <Button
            type="submit"
            size="sm"
            disabled={disabled || !date}
            className="h-7 px-2.5 text-[13px]"
          >
            {t('publicLink.setDate')}
          </Button>
        </form>
      )}
    </div>
  );
}
