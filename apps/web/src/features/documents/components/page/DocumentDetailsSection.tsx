'use client';

import type { ComponentProps, ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { usePersistedOpen } from '@/hooks/usePersistedOpen';
import { cn } from '@/lib/utils';

// One collapsible section of the page details, shaped like the sections of the issue
// sidebar. The action shows only while the section is open.
export default function DocumentDetailsSection({
  id,
  title,
  count,
  action,
  className,
  children,
  ...props
}: Omit<ComponentProps<'section'>, 'title'> & {
  id: string;
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  const { open, toggle } = usePersistedOpen(`document-details-${id}-open`);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <section
      id={`document-details-${id}`}
      className={cn(
        'relative mt-6 scroll-mt-2 border-t pt-5 first:mt-0 first:border-t-0 first:pt-1',
        !open && '-mb-2',
        className,
      )}
      {...props}
    >
      <div className={cn('flex h-7 items-center justify-between gap-3', open && 'mb-3')}>
        <button
          type="button"
          aria-expanded={open}
          className="flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
          onClick={toggle}
        >
          <Chevron className="size-3.5" />
          {title}
          {count ? <span className="tabular-nums">{count}</span> : null}
        </button>
        {open && action}
      </div>
      {open && children}
    </section>
  );
}
