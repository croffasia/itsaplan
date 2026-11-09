// A small uppercase heading over a block of the capability list: its label, the
// row count and an optional action for the whole block.
export function AgentCapabilityHeading({
  label,
  count,
  action,
  onAction,
}: {
  label: string;
  count: number;
  action?: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center gap-2 pb-1">
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-[11px] text-muted-foreground/70 tabular-nums">{count}</span>
      {action && (
        <button
          type="button"
          className="ms-auto text-xs text-muted-foreground hover:text-foreground"
          onClick={onAction}
        >
          {action}
        </button>
      )}
    </div>
  );
}
