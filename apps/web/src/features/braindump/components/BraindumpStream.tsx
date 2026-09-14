import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/common/page/EmptyState';
import type { BraindumpDestination, BraindumpEntry } from '@/lib/api';
import { filterEntries, groupByDay, type StreamFilter } from '../utils/braindump';
import {
  useDeleteBraindumpEntry,
  useRouteBraindumpEntry,
  useUpdateBraindumpEntry,
} from '../services/braindump.service';
import BraindumpDayGroup from './BraindumpDayGroup';
import BraindumpRenameDialog from './BraindumpRenameDialog';
import BraindumpScheduleDialog from './BraindumpScheduleDialog';
import BraindumpStreamFilters from './BraindumpStreamFilters';

export default function BraindumpStream({
  projectKey,
  entries,
  obsidianAvailable,
  canEdit,
  canDelete,
}: {
  projectKey: string;
  entries: BraindumpEntry[];
  obsidianAvailable: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [filter, setFilter] = useState<StreamFilter>({ type: 'all' });
  const [search, setSearch] = useState('');
  const [scheduling, setScheduling] = useState<BraindumpEntry | null>(null);
  const [renaming, setRenaming] = useState<BraindumpEntry | null>(null);

  const route = useRouteBraindumpEntry(projectKey);
  const update = useUpdateBraindumpEntry(projectKey);
  const remove = useDeleteBraindumpEntry(projectKey);

  const visible = useMemo(() => filterEntries(entries, filter, search), [entries, filter, search]);
  const groups = useMemo(() => groupByDay(visible), [visible]);

  const onRoute = (entry: BraindumpEntry, destination: BraindumpDestination) => {
    if (destination === 'schedule') {
      setScheduling(entry);
      return;
    }
    route.mutate({ entryId: entry.id, route: { destination } });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Captured stream
        </h2>
        <span className="text-xs text-muted-foreground">
          {visible.length} of {entries.length} dumps · last 7 days
        </span>
      </div>

      <BraindumpStreamFilters
        entries={entries}
        filter={filter}
        onFilterChange={setFilter}
        search={search}
        onSearchChange={setSearch}
      />

      {groups.length === 0 ? (
        <EmptyState
          title={entries.length === 0 ? 'Nothing captured yet' : 'No dumps match this filter'}
          description={
            entries.length === 0
              ? 'Type or dictate a thought above; it lands here straight away.'
              : 'Clear the filter or search for something else.'
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <BraindumpDayGroup
              key={group.key}
              group={group}
              obsidianAvailable={obsidianAvailable}
              canEdit={canEdit}
              canDelete={canDelete}
              onRoute={onRoute}
              onTogglePin={(entry) =>
                update.mutate({ entryId: entry.id, patch: { pinned: !entry.pinned } })
              }
              onRename={setRenaming}
              onDelete={(entry) => remove.mutate(entry.id)}
            />
          ))}
        </div>
      )}

      <BraindumpRenameDialog
        entry={renaming}
        onOpenChange={(open) => !open && setRenaming(null)}
        onRename={(title) => {
          if (renaming) update.mutate({ entryId: renaming.id, patch: { title } });
          setRenaming(null);
        }}
      />

      <BraindumpScheduleDialog
        projectKey={projectKey}
        open={scheduling != null}
        onOpenChange={(open) => !open && setScheduling(null)}
        onConfirm={(input) => {
          if (scheduling) {
            route.mutate({ entryId: scheduling.id, route: { destination: 'schedule', ...input } });
          }
          setScheduling(null);
        }}
      />
    </section>
  );
}
