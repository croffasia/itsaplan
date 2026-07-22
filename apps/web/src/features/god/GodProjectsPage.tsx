'use client';

import { useState } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import GodSearchInput from './components/GodSearchInput';
import GodSectionPage from './components/GodSectionPage';
import GodPager, { PAGE_SIZES } from './components/GodPager';
import GodProjectDetailPanel from './components/projects/GodProjectDetailPanel';
import GodProjectsTable from './components/projects/GodProjectsTable';
import { useInstanceProjectsQuery } from './services/god.service';
import { withOffsetReset } from './utils/paging';

// The instance project directory: one row per project with what it holds, and a side
// panel showing every member and the permissions their membership resolves to. Like
// the user directory, search and paging run on the server, so the list never holds
// every project.
export default function GodProjectsPage() {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState<number>(PAGE_SIZES[1]);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  // Typing refetches, so wait for a pause instead of firing per keystroke.
  const debouncedSearch = useDebouncedValue(search, 300);

  const projectsQuery = useInstanceProjectsQuery({ search: debouncedSearch, limit, offset });
  const projects = projectsQuery.data?.items ?? [];
  const total = projectsQuery.data?.total ?? 0;

  return (
    <GodSectionPage slug="projects" widthClassName="max-w-none">
      <div className="space-y-4">
        <GodSearchInput
          value={search}
          onChange={withOffsetReset(setOffset, setSearch)}
          placeholder="Search by key or name"
          className="max-w-md min-w-[240px]"
        />

        {projectsQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects match this search.</p>
        ) : (
          <>
            <GodProjectsTable projects={projects} onSelect={setSelected} />
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

      {selected !== null && (
        <GodProjectDetailPanel projectId={selected} onClose={() => setSelected(null)} />
      )}
    </GodSectionPage>
  );
}
