import PanelEmpty from './PanelEmpty';

export interface BarRow {
  key: string;
  label: string;
  value: number;
  trailing: string;
}

// A share is taken against the largest row rather than the total, so a list of one still
// fills its track.
export default function BarList({
  rows,
  empty,
  onSelect,
}: {
  rows: BarRow[];
  empty: string;
  onSelect?: (key: string) => void;
}) {
  if (rows.length === 0) return <PanelEmpty label={empty} />;
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const content = (
          <>
            <div className="h-6 min-w-0 flex-1 rounded-sm bg-muted/40">
              <div
                className="flex h-full min-w-fit items-center rounded-sm bg-primary/85"
                style={{ width: `${(row.value / max) * 100}%` }}
              >
                <span className="truncate px-2 text-xs text-primary-foreground">{row.label}</span>
              </div>
            </div>
            <span className="w-20 shrink-0 text-end text-xs text-muted-foreground tabular-nums">
              {row.trailing}
            </span>
          </>
        );
        return onSelect ? (
          <button
            key={row.key}
            type="button"
            onClick={() => onSelect(row.key)}
            className="flex w-full items-center gap-3 rounded-sm text-start hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {content}
          </button>
        ) : (
          <div key={row.key} className="flex items-center gap-3">
            {content}
          </div>
        );
      })}
    </div>
  );
}
