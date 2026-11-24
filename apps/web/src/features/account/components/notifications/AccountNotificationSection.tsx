import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export default function AccountNotificationSection({
  title,
  actions,
  sticky = false,
  children,
}: {
  title: string;
  actions?: ReactNode;
  sticky?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="border-t py-8">
      <div
        className={cn(
          'mb-1 flex min-h-8 flex-wrap items-center justify-between gap-x-4',
          sticky && 'sticky top-12 z-10 -mx-3 -mt-2 -mb-1 bg-background px-3 py-2',
        )}
      >
        <h2 className="text-sm font-medium">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
