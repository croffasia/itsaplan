'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { EmailPreview } from '@/lib/api/endpoints/god';

const SAMPLE_RECIPIENT = 'anna@example.com';

export default function GodEmailPreviewMeta({
  email,
  dir,
}: {
  email: EmailPreview;
  dir: 'ltr' | 'rtl';
}) {
  const t = useTranslations('god.emailTemplates');
  const rows = [
    { label: t('from'), value: email.from, valueDir: 'ltr' },
    { label: t('to'), value: SAMPLE_RECIPIENT, valueDir: 'ltr' },
    { label: t('subject'), value: email.subject, strong: true },
  ];

  return (
    <dl dir={dir} className="flex flex-col gap-0.5 border-b border-[#ececec] px-4 py-3 text-xs">
      {rows.map(
        ({ label, value, valueDir, strong }) =>
          value && (
            <div key={label} className="flex gap-2">
              <dt className="w-16 shrink-0 text-[#6b6b6b]">{label}</dt>
              <dd dir={valueDir} className={cn('min-w-0', strong && 'font-semibold')}>
                {value}
              </dd>
            </div>
          ),
      )}
    </dl>
  );
}
