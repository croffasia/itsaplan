'use client';

import type { RefObject } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  Link,
  List,
  ListOrdered,
  Strikethrough,
  TextQuote,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  prefixLine,
  selectAfterEdit,
  wrapSelection,
  type TextEdit,
} from '../../utils/emailMarkdown';

export default function GodEmailMarkdownToolbar({
  area,
  value,
  onChange,
}: {
  area: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('god.emailTemplates');

  function apply(edit: (start: number, end: number) => TextEdit) {
    const element = area.current;
    if (!element) return;
    const next = edit(element.selectionStart, element.selectionEnd);
    onChange(next.value);
    selectAfterEdit(element, next);
  }

  const wrap = (before: string, after: string, sample: string) => () =>
    apply((start, end) => wrapSelection(value, start, end, before, after, sample));
  const prefix = (marker: string) => () => apply((start) => prefixLine(value, start, marker));

  const groups: { label: string; icon: LucideIcon; run: () => void }[][] = [
    [
      { label: t('heading1'), icon: Heading1, run: prefix('# ') },
      { label: t('heading2'), icon: Heading2, run: prefix('## ') },
    ],
    [
      { label: t('bold'), icon: Bold, run: wrap('**', '**', t('boldSample')) },
      { label: t('italic'), icon: Italic, run: wrap('*', '*', t('italicSample')) },
      { label: t('strikethrough'), icon: Strikethrough, run: wrap('~~', '~~', t('strikeSample')) },
      { label: t('link'), icon: Link, run: wrap('[', '](https://)', t('linkSample')) },
    ],
    [
      { label: t('bulletedList'), icon: List, run: prefix('- ') },
      { label: t('numberedList'), icon: ListOrdered, run: prefix('1. ') },
      { label: t('quote'), icon: TextQuote, run: prefix('> ') },
    ],
  ];

  return (
    <div
      role="toolbar"
      aria-label={t('formatting')}
      className="flex flex-wrap items-center gap-0.5 border-b p-1"
    >
      {groups.map((group, index) => (
        <div key={index} className="flex items-center gap-0.5 not-first:ms-1.5">
          {group.map(({ label, icon: Icon, run }) => (
            <Button
              key={label}
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              aria-label={label}
              title={label}
              onClick={run}
            >
              <Icon className="size-4" />
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
