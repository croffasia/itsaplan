// A Linear-style pill trigger: rounded, muted, icon + label. Used by the field
// selects, the new-issue modal and the issue detail panel so every field trigger
// looks the same.
export function Pill({
  active,
  children,
  ...props
}: { active?: boolean } & React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={`flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-sm transition-colors hover:bg-accent [&_svg:not([class*='size-'])]:size-3.5 ${
        active ? 'text-foreground' : 'text-muted-foreground'
      }`}
      {...props}
    >
      {children}
    </button>
  );
}
