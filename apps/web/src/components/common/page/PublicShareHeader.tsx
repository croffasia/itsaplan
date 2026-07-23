// The header over a public shared page (a board or an issue): the project's name
// and ticker, with an optional trailing label (the shared view's name on a board).
// Read-only identity only — no navigation or session.
export default function PublicShareHeader({
  name,
  ticker,
  trailing,
}: {
  name: string;
  ticker: string;
  trailing?: string;
}) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-base font-semibold">{name}</span>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          {ticker}
        </span>
      </div>
      {trailing && (
        <span className="ml-auto truncate text-sm text-muted-foreground">{trailing}</span>
      )}
    </header>
  );
}
