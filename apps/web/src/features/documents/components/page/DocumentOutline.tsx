'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { DocumentOutlineItem } from '../../hooks/useDocumentOutline';

export default function DocumentOutline({
  outline,
  activeIndex,
  onJump,
}: {
  outline: DocumentOutlineItem[];
  activeIndex: number;
  onJump: (index: number) => void;
}) {
  const t = useTranslations('documents');
  const topLevel = Math.min(...outline.map((item) => item.level));

  return (
    <nav
      aria-label={t('outline')}
      className="sticky top-6 max-h-[calc(100dvh-12rem)] max-w-55 overflow-y-auto"
    >
      <p className="mb-2 text-xs font-medium text-muted-foreground">{t('onThisPage')}</p>
      <ol>
        {outline.map((item, index) => {
          const active = index === activeIndex;
          return (
            <li key={item.position}>
              <button
                type="button"
                className={cn(
                  'relative block w-full truncate rounded-sm py-[5px] pe-2 text-start text-[13px] leading-[1.4] text-muted-foreground transition-colors before:absolute before:inset-y-1.5 before:start-0 before:w-0.5 before:scale-y-0 before:rounded-full before:bg-foreground before:transition-transform hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:before:transition-none',
                  active && 'font-medium text-foreground before:scale-y-100',
                )}
                style={{ paddingInlineStart: `${12 + (item.level - topLevel) * 12}px` }}
                dir="auto"
                aria-current={active ? 'location' : undefined}
                onClick={() => onJump(index)}
              >
                {item.text || t('untitledHeading')}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
