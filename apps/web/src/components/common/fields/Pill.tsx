// A Linear-style pill trigger: rounded, muted, icon + label. Used by the field
// selects, the new-issue modal and the issue detail panel so every field trigger
// looks the same. It never grows past the room it is given, so a caller puts its
// text in a `truncate` span rather than letting a long value push out of the
// column. `data-pill` lets a container restyle the pills inside it; `data-slot` would
// not do, since a popover trigger wrapping the pill replaces it.
export function Pill({
  active,
  children,
  ...props
}: { active?: boolean } & React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      data-pill
      className={`flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full border px-2.5 text-sm transition-colors hover:bg-accent [&_svg:not([class*='size-'])]:size-3.5 [&>svg]:shrink-0 ${
        active ? 'text-foreground' : 'text-muted-foreground'
      }`}
      {...props}
    >
      {children}
    </button>
  );
}
