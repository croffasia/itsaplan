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
      // Selection collapses on mousedown-then-click otherwise — the bubble
      // menu would disappear before the command runs.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5',
        active && 'bg-accent text-accent-foreground',
      )}
    >
      {children}
    </button>
  );
}
