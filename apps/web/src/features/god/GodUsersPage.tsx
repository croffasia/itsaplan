'use client';

import { useState } from 'react';
import type { InstanceUserKind } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import GodSectionPage from './components/GodSectionPage';
import GodUsersTable from './components/users/GodUsersTable';
import GodUsersToolbar from './components/users/GodUsersToolbar';
import GodPager, { PAGE_SIZES } from './components/GodPager';
import GodUserDetailPanel from './components/users/GodUserDetailPanel';
import { useInstanceUsersQuery } from './services/god.service';
import { withOffsetReset } from './utils/paging';

// The instance user directory: one row per account, with a side panel showing the
// projects a user can reach and the permissions their membership resolves to. The
// table is wide, so the page spans the whole shell instead of the centered settings
// column the other sections use.
//
// Search, the kind filter and paging all run on the server: the query carries them
// and gets back one page plus the total, so the list never holds every account.
export default function GodUsersPage() {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<InstanceUserKind>('human');
  const [limit, setLimit] = useState<number>(PAGE_SIZES[1]);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  // Typing refetches, so wait for a pause instead of firing per keystroke.
  const debouncedSearch = useDebouncedValue(search, 300);

  const usersQuery = useInstanceUsersQuery({ search: debouncedSearch, kind, limit, offset });
  const users = usersQuery.data?.items ?? [];
  const total = usersQuery.data?.total ?? 0;

  return (
    <GodSectionPage slug="users" widthClassName="max-w-none">
      <div className="space-y-4">
        <GodUsersToolbar
          search={search}
          onSearchChange={withOffsetReset(setOffset, setSearch)}
          kind={kind}
          onKindChange={withOffsetReset(setOffset, setKind)}
        />

        {usersQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts match these filters.</p>
        ) : (
          <>
            <GodUsersTable users={users} onSelect={setSelected} />
            <GodPager
              offset={offset}
              limit={limit}
              total={total}
              onOffsetChange={setOffset}
              onLimitChange={withOffsetReset(setOffset, setLimit)}
            />
          </>
        )}
      </div>

      {selected && <GodUserDetailPanel userId={selected} onClose={() => setSelected(null)} />}
    </GodSectionPage>
  );
}
