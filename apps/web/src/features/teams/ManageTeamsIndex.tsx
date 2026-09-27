'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { teamPath } from '@/utils/paths';
import { useTeamsQuery } from '@/services/teams.service';

// The page with no team in the URL. It opens the first team of the list; an account
// with none has only the rail's create action left.
export default function ManageTeamsIndex() {
  const t = useTranslations('teams.manage');
  const router = useRouter();
  const { data } = useTeamsQuery();
  const first = data?.[0];

  useEffect(() => {
    if (first) router.replace(teamPath(first.ref));
  }, [first, router]);

  return (
    <div className="flex min-w-0 flex-1 items-center justify-center p-8">
      {data?.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
    </div>
  );
}
