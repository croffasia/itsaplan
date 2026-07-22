// Tab counts cap at 99+ so a long label never widens the tab bar.
export default function InitiativeTabCount({ value }: { value: number }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground tabular-nums">
      {value > 99 ? '99+' : value}
    </span>
  );
}
