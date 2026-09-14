// The right-hand side of a page header: today's date, and when the page last
// refetched. Pass null until the component has mounted — a server-rendered clock
// would differ from the client's and break hydration.
export default function PageDateStamp({ updatedAt }: { updatedAt: Date | null }) {
  const today = new Date();
  return (
    <div className="text-right">
      <p className="text-xs font-medium tabular-nums">
        {today.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' })}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
        {updatedAt
          ? `Last updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : 'Loading…'}
      </p>
    </div>
  );
}
