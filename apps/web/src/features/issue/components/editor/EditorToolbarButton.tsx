import { cn } from '@/lib/utils';

export default function EditorToolbarButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // Selection collapses on mousedown-then-click otherwise — the bubble
      // menu would disappear before the command runs.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground [&_svg]:size-3.5',
        active && 'bg-accent text-accent-foreground',
      )}
    >
      {children}
    </button>
  );
}
