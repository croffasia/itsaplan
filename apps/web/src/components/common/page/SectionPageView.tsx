import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import PageHeader from './PageHeader';

// The chrome for a section page rendered inside the app shell: the scroll
// container, a centered column, and a header (title and description). Used by
// the settings and members section pages. `widthClassName` overrides the centered
// column's width constraints (e.g. a section that wants a narrower cap than `wide`).
export default function SectionPageView({
  title,
  description,
  actions,
  wide = false,
  widthClassName,
  children,
}: {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
  widthClassName?: string;
  children: ReactNode;
}) {
  const padding = wide ? 'px-4 pt-5 pb-4 sm:px-6 lg:px-8' : 'px-8 py-10';
  const width = widthClassName ?? (wide ? 'max-w-[1600px]' : 'max-w-4xl');
  // A custom width is left-aligned (the caller controls the span); the default
  // widths are centered.
  const align = widthClassName ? '' : 'mx-auto';
  return (
    <div className="flex-1 overflow-y-auto">
      <div className={cn(align, 'w-full', width, padding)}>
        <PageHeader title={title} description={description} actions={actions} />
        {children}
      </div>
    </div>
  );
}
