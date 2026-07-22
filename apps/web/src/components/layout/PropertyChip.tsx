import { cn } from '@/lib/utils';

export default function PropertyChip({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2 py-0.5 text-xs transition-colors',
        on
          ? 'border-primary bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}
