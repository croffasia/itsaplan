'use client';

import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { Paging } from '@/hooks/usePaging';
import type { ReceivedInvite } from '@/lib/api/endpoints/invites';
import { Button } from '@/components/ui/button';
import ListPager from '@/components/common/ListPager';
import ReceivedInvitesList from '@/components/common/invites/ReceivedInvitesList';
import { LocaleToggle } from '@/components/locale-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import UserMenu from '@/components/layout/UserMenu';

export default function InviteStartList({
  items,
  total,
  paging,
  loading,
  failed,
  retrying,
  onRetry,
  onContinue,
}: {
  items: ReceivedInvite[];
  total: number;
  paging: Paging;
  loading: boolean;
  failed: boolean;
  retrying: boolean;
  onRetry: () => void;
  onContinue: () => void;
}) {
  const t = useTranslations('invite.received');
  useDocumentTitle(t('title'));

  return (
    <main className="relative min-h-svh">
      <div className="absolute end-4 top-3 flex items-center gap-1">
        <LocaleToggle />
        <ThemeToggle />
        <UserMenu />
      </div>
      <div className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-6 px-6 py-20">
        <header>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('description')}</p>
        </header>
        {loading && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('loading')}
          </p>
        )}
        {!loading && failed && (
          <div role="alert" className="space-y-3">
            <p className="text-sm text-destructive">{t('loadFailed')}</p>
            <Button variant="outline" disabled={retrying} onClick={onRetry}>
              {t('retry')}
            </Button>
          </div>
        )}
        {!loading && !failed && (
          <>
            <ReceivedInvitesList items={items} />
            <ListPager paging={paging} total={total} />
          </>
        )}
        <Button variant="ghost" className="self-start" onClick={onContinue}>
          {t('continue')}
        </Button>
      </div>
    </main>
  );
}
