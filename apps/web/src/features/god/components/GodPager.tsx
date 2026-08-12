'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const PAGE_SIZES = [25, 50, 100] as const;

// The pager under a directory table (accounts, projects): which slice is on screen,
// how big a page is, and a step in either direction. Page size sits next to the
// range so both read as one statement about the window.
export default function GodPager({
  offset,
  limit,
  total,
  onOffsetChange,
  onLimitChange,
}: {
  offset: number;
  limit: number;
  total: number;
  onOffsetChange: (offset: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  const t = useTranslations('god.pager');
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{t('perPage')}</span>
        <Select value={String(limit)} onValueChange={(v) => onLimitChange(Number(v))}>
          <SelectTrigger size="sm" className="w-[72px]" aria-label={t('rowsPerPage')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{t('range', { first, last, total })}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t('previous')}
            disabled={offset === 0}
            onClick={() => onOffsetChange(Math.max(0, offset - limit))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t('next')}
            disabled={last >= total}
            onClick={() => onOffsetChange(offset + limit)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
