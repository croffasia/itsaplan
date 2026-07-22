import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from './PageHeader';

// The chrome for a standalone full-height page rendered outside the app shell:
// its own top bar with a back link and a label, and a centered column with a
// header (title and description). Used by pages like account settings.
export default function FullPageView({
  label,
  title,
  description,
  actions,
  children,
}: {
  label: string;
  title: string;
  description: ReactNode;
  // Rendered on the right of the header row, aligned with the title.
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background">
      <header className="flex h-12 items-center gap-2 border-b px-4">
        <Button asChild variant="ghost" size="icon" className="size-8" title="Back">
          <Link href="/">
            <ArrowLeft />
          </Link>
        </Button>
        <span className="text-sm font-medium">{label}</span>
      </header>
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        <PageHeader title={title} description={description} actions={actions} />
        {children}
      </div>
    </div>
  );
}
