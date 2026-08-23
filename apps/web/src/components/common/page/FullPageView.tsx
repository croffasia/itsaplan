import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import PageHeader from './PageHeader';
import { useTranslations } from 'next-intl';

// The chrome for a standalone full-height page rendered outside the app shell:
// its own top bar with a back link and a label, and a centered column with a
// header (title and description). Used by pages like account settings.
export default function FullPageView({
  label,
  title,
  description,
  actions,
  nav,
  children,
}: {
  label: string;
  title: string;
  description: ReactNode;
  // Rendered on the right of the header row, aligned with the title.
  actions?: ReactNode;
  // A section rail placed left of the content column on wide viewports; the page
  // widens to make room for it.
  nav?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations('common');
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background px-4">
        <Button asChild variant="ghost" size="icon" className="size-8" title={t('back')}>
          <Link href="/">
            <ArrowLeft />
          </Link>
        </Button>
        <span className="text-sm font-medium">{label}</span>
      </header>
      <div
        className={cn(
          'mx-auto flex w-full gap-10 px-8 py-10',
          nav ? 'max-w-[1000px]' : 'max-w-3xl',
        )}
      >
        {nav}
        <div className="w-full max-w-3xl min-w-0">
          <PageHeader title={title} description={description} actions={actions} />
          {children}
        </div>
      </div>
    </div>
  );
}
