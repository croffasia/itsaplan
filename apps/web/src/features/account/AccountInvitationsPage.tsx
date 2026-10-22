'use client';

import { useTranslations } from 'next-intl';
import { useSession } from '@/lib/auth-client';
import { usePaging } from '@/hooks/usePaging';
import { useReceivedInvitesQuery } from '@/services/invites.service';
import FullPageView from '@/components/common/page/FullPageView';
import ReceivedInvitesList from '@/components/common/invites/ReceivedInvitesList';
import ListPager from '@/components/common/ListPager';
import { Button } from '@/components/ui/button';

export default function AccountInvitationsPage() {
  const t = useTranslations('invite.received');
  const sectionLabel = useTranslations('sections.account');
  const session = useSession();
  const user = session.data?.user;
  const paging = usePaging();
  const query = useReceivedInvitesQuery(user, paging.params);

  let content;
  if (session.isPending || (user?.emailVerified && query.isPending)) {
    content = (
      <p role="status" className="py-6 text-sm text-muted-foreground">
        {t('loading')}
      </p>
    );
  } else if (!user?.emailVerified) {
    content = <p className="py-6 text-sm text-muted-foreground">{t('verifyRequired')}</p>;
  } else if (query.isError) {
    content = (
      <div role="alert" className="space-y-3 py-6">
        <p className="text-sm text-destructive">{t('loadFailedAccount')}</p>
        <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
          {t('retry')}
        </Button>
      </div>
    );
  } else if (query.data?.total === 0) {
    content = (
      <p role="status" className="py-6 text-sm text-muted-foreground">
        {t('empty')}
      </p>
    );
  } else {
    content = (
      <div className="space-y-6">
        <ReceivedInvitesList items={query.data?.items ?? []} />
        <ListPager paging={paging} total={query.data?.total ?? 0} />
      </div>
    );
  }

  return (
    <FullPageView
      label={sectionLabel('invitations')}
      title={t('title')}
      description={t('description')}
    >
      {content}
    </FullPageView>
  );
}
