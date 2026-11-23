'use client';

import { useTranslations } from 'next-intl';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';

// The Open and Resolved switch of the comments panel, each with its thread count.
export default function DocumentCommentsTabs({
  open,
  resolved,
}: {
  open: number;
  resolved: number;
}) {
  const t = useTranslations('documents.comments');
  return (
    <TabsList aria-label={t('showComments')} className="h-7 gap-0.5 rounded-md bg-muted/80 p-0.5">
      {(['open', 'resolved'] as const).map((value) => (
        <TabsTrigger
          key={value}
          value={value}
          className="h-6 flex-none gap-1.5 rounded-sm px-2 text-xs text-muted-foreground data-[state=active]:text-foreground"
        >
          {t(value)}
          <span className="tabular-nums">{value === 'open' ? open : resolved}</span>
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
