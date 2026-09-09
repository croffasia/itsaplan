'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { InstanceUserKind } from '@/lib/api/endpoints/god';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePaging } from '@/hooks/usePaging';
import ListPager from '@/components/common/ListPager';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import GodSectionPage from './components/GodSectionPage';
import GodUsersTable from './components/users/GodUsersTable';
import GodUsersToolbar from './components/users/GodUsersToolbar';
import GodUserDetailPanel from './components/users/GodUserDetailPanel';
import { useInstanceUsersQuery } from './services/god.service';

// The instance user directory: one row per account, with a side panel showing the
// projects a user can reach and the permissions their membership resolves to. The
// table is wide, so the page spans the whole shell instead of the centered settings
// column the other sections use.
//
// Search, the kind filter and paging all run on the server: the query carries them
// and gets back one page plus the total, so the list never holds every account.
export default function GodUsersPage() {
  const t = useTranslations('god.users');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<InstanceUserKind>('human');
  const paging = usePaging(25);
  const [selected, setSelected] = useState<string | null>(null);

  // Typing refetches, so wait for a pause instead of firing per keystroke.
  const debouncedSearch = useDebouncedValue(search, 300);

  const usersQuery = useInstanceUsersQuery({
    search: debouncedSearch,
    kind,
    ...paging.params,
  });
  const users = usersQuery.data?.items ?? [];
  const total = usersQuery.data?.total ?? 0;

  return (
    <GodSectionPage slug="users" widthClassName="max-w-none">
      <div className="space-y-4">
        <GodUsersToolbar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            paging.reset();
          }}
          kind={kind}
          onKindChange={(value) => {
            setKind(value);
            paging.reset();
          }}
        />

        {usersQuery.isPending ? (
          <ListSkeleton rows={6} rowClassName="h-12" />
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <>
            <GodUsersTable users={users} onSelect={setSelected} />
            <ListPager paging={paging} total={total} />
          </>
        )}
      </div>

      {selected && <GodUserDetailPanel userId={selected} onClose={() => setSelected(null)} />}
    </GodSectionPage>
  );
}
