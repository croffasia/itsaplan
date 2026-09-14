import type { BraindumpDestination, BraindumpEntry } from '@/lib/api';
import type { DayGroup } from '../utils/braindump';
import BraindumpCard from './BraindumpCard';

export default function BraindumpDayGroup({
  group,
  obsidianAvailable,
  canEdit,
  canDelete,
  onRoute,
  onTogglePin,
  onRename,
  onDelete,
}: {
  group: DayGroup;
  obsidianAvailable: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onRoute: (entry: BraindumpEntry, destination: BraindumpDestination) => void;
  onTogglePin: (entry: BraindumpEntry) => void;
  onRename: (entry: BraindumpEntry) => void;
  onDelete: (entry: BraindumpEntry) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {group.label}
        </h3>
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground tabular-nums">
          {group.entries.length} {group.entries.length === 1 ? 'dump' : 'dumps'}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {group.entries.map((entry) => (
          <BraindumpCard
            key={entry.id}
            entry={entry}
            obsidianAvailable={obsidianAvailable}
            canEdit={canEdit}
            canDelete={canDelete}
            onRoute={(destination) => onRoute(entry, destination)}
            onTogglePin={() => onTogglePin(entry)}
            onRename={() => onRename(entry)}
            onDelete={() => onDelete(entry)}
          />
        ))}
      </div>
    </section>
  );
}
