// A tab's initiative count, capped at 99+ so a long label never widens the tab
// bar. Renders nothing until the count has loaded.
export default function InitiativeTabCount({ value }: { value: number | undefined }) {
  if (value == null) return null;
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground tabular-nums">
      {value > 99 ? '99+' : value}
    </span>
  );
}
