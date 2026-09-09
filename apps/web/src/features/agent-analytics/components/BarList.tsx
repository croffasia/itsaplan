import PanelEmpty from './PanelEmpty';
import { formatCount } from '../utils/format';

// One row of a bar list: a name over a bar whose width is its share of the largest
// row, and the row's own figure at the end.
export interface BarRow {
  key: string;
  label: string;
  value: number;
  // The part of `value` drawn in the error colour — the failed runs of an agent, the
  // failed calls of a tool.
  split?: number;
  // What to print at the end instead of the value counted (an amount, say).
  trailing?: string;
}

// The list the token and volume panels are read from: sorted rows, the widest bar
// filling the track. A share is taken against the largest row rather than the total,
// so a list of one still fills its track.
export default function BarList({
  rows,
  empty,
  splitLabel,
}: {
  rows: BarRow[];
  empty: string;
  splitLabel?: string;
}) {
  if (rows.length === 0) return <PanelEmpty label={empty} />;
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const split = row.split ?? 0;
        return (
          <div key={row.key} className="flex items-center gap-3">
            <div className="h-6 min-w-0 flex-1 rounded-sm bg-muted/40">
              <div
                className="flex h-full min-w-fit items-center rounded-sm bg-primary/85"
                style={{ width: `${(row.value / max) * 100}%` }}
              >
                <span className="truncate px-2 text-xs text-primary-foreground">{row.label}</span>
                {split > 0 && (
                  <span
                    className="ms-auto h-full rounded-e-sm bg-destructive"
                    style={{ width: `${(split / row.value) * 100}%` }}
                    title={splitLabel}
                  />
                )}
              </div>
            </div>
            <span className="w-20 shrink-0 text-end text-xs text-muted-foreground tabular-nums">
              {row.trailing ?? formatCount(row.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
