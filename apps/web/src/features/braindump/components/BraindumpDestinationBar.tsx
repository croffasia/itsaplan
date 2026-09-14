// One destination row under the filed counter: a label, a proportional bar and the
// count. `share` is already normalised against the busiest destination.
export default function BraindumpDestinationBar({
  label,
  count,
  share,
}: {
  label: string;
  count: number;
  share: number;
}) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-24 shrink-0 truncate text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/70"
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right tabular-nums">{count}</span>
    </div>
  );
}
