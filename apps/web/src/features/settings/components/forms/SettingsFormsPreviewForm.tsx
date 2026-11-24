'use client';

import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

const QUESTIONS = [
  { width: '40%', tall: false },
  { width: '55%', tall: true },
  { width: '30%', tall: false },
  { width: '45%', tall: false },
];

// The name and the email are asked on every form, before its own questions.
export default function SettingsFormsPreviewForm() {
  const t = useTranslations('sections.previews.forms');

  return (
    <div className="hidden min-w-0 flex-col border-s ps-6 md:flex">
      <span className="flex h-9 items-center text-xs text-muted-foreground">{t('preview')}</span>
      <div className="mt-2 space-y-6 rounded-lg border border-border/60 p-6">
        <div className="space-y-3">
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-3 w-4/5" />
        </div>
        {[t('name'), t('email')].map((label) => (
          <div key={label} className="space-y-1.5">
            <div className="text-sm font-medium">{label}</div>
            <Skeleton className="h-9" />
          </div>
        ))}
        {QUESTIONS.map(({ width, tall }) => (
          <div key={width} className="space-y-1.5">
            <Skeleton className="h-3.5" style={{ width }} />
            <Skeleton className={tall ? 'h-20' : 'h-9'} />
          </div>
        ))}
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}
