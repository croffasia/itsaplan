import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import TeamsPageRail from './TeamsPageRail';

// The chrome of the teams page, which is full height and outside the app shell: its
// own top bar with a back link and a label, then the rail of workspaces, the list
// beside it and the rest of the columns, which the children bring.
export default function TeamsPageView({
  label,
  rail,
  list,
  children,
}: {
  label: string;
  rail: ReactNode;
  list: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations('common');
  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <Button asChild variant="ghost" size="icon" className="size-8" title={t('back')}>
          <Link href="/">
            <ArrowLeft />
          </Link>
        </Button>
        <span className="text-sm font-medium">{label}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {rail}
        <TeamsPageRail className="lg:w-64">{list}</TeamsPageRail>
        {children}
      </div>
    </div>
  );
}
