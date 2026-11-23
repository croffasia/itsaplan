import { cn } from '@/lib/utils';

export default function EditorToolbarButton({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      // Selection collapses on mousedown-then-click otherwise — the bubble
      // menu would disappear before the command runs.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex size-7.5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5',
        active && 'bg-accent text-foreground',
      )}
    >
      {children}
    </button>
  );
}
