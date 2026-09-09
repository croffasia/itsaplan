'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePaging } from '@/hooks/usePaging';
import ListPager from '@/components/common/ListPager';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SearchInput from '@/components/common/SearchInput';
import GodSectionPage from './components/GodSectionPage';
import GodTeamDetailPanel from './components/teams/GodTeamDetailPanel';
import GodTeamsTable from './components/teams/GodTeamsTable';
import { useInstanceTeamsQuery } from './services/god.service';

// The instance team directory: one row per team with what it holds, and a side panel
// showing the projects it owns and everyone in it. Search and paging run on the
// server, like the user and project directories.
export default function GodTeamsPage() {
  const t = useTranslations('god.teams');
  const [search, setSearch] = useState('');
  const paging = usePaging(25);
  const [selected, setSelected] = useState<number | null>(null);

  // Typing refetches, so wait for a pause instead of firing per keystroke.
  const debouncedSearch = useDebouncedValue(search, 300);

  const teamsQuery = useInstanceTeamsQuery({ search: debouncedSearch, ...paging.params });
  const teams = teamsQuery.data?.items ?? [];
  const total = teamsQuery.data?.total ?? 0;

  return (
    <GodSectionPage slug="teams" widthClassName="max-w-none">
      <div className="space-y-4">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            paging.reset();
          }}
          placeholder={t('searchPlaceholder')}
          className="max-w-md min-w-[240px]"
        />

        {teamsQuery.isPending ? (
          <ListSkeleton rows={6} rowClassName="h-12" />
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <>
            <GodTeamsTable teams={teams} onSelect={setSelected} />
            <ListPager paging={paging} total={total} />
          </>
        )}
      </div>

      {selected !== null && (
        <GodTeamDetailPanel teamId={selected} onClose={() => setSelected(null)} />
      )}
    </GodSectionPage>
  );
}
