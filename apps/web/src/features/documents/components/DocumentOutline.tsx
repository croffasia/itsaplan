'use client';

import type { RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useDocumentOutline } from '../hooks/useDocumentOutline';

export default function DocumentOutline({
  editor,
  scrollRef,
  belowToolbar,
}: {
  editor: Editor | null;
  scrollRef: RefObject<HTMLElement | null>;
  belowToolbar: boolean;
}) {
  const t = useTranslations('documents');
  const { outline, activeIndex, jumpTo } = useDocumentOutline(editor, scrollRef);

  if (outline.length === 0) return null;
  const topLevel = Math.min(...outline.map((item) => item.level));

  return (
    <nav
      aria-label={t('outline')}
      className={cn(
        'sticky ms-auto hidden max-h-[calc(100dvh-12rem)] w-full max-w-60 overflow-y-auto ps-4 pe-3 @min-[10rem]:block',
        belowToolbar ? 'top-22' : 'top-8',
      )}
    >
      <p className="mb-2 text-xs font-medium text-muted-foreground">{t('outline')}</p>
      <ol className="border-s">
        {outline.map((item, index) => (
          <li key={item.position}>
            <button
              type="button"
              className={cn(
                '-ms-px block w-full truncate border-s border-transparent py-1 pe-1 text-start text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                index === activeIndex && 'border-foreground font-medium text-foreground',
              )}
              style={{ paddingInlineStart: `${12 + (item.level - topLevel) * 12}px` }}
              dir="auto"
              aria-current={index === activeIndex ? 'location' : undefined}
              onClick={() => jumpTo(index)}
            >
              {item.text || t('untitledHeading')}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
