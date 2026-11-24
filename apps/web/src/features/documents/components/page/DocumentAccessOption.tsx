import type { DocumentVisibility } from '@/lib/api/endpoints/documents';
import { cn } from '@/lib/utils';
import { DOCUMENT_ACCESS_ICON } from '../../utils/documentAccess';

export default function DocumentAccessOption({
  visibility,
  label,
  checked,
  disabled,
  onSelect,
}: {
  visibility: DocumentVisibility;
  label: string;
  checked: boolean;
  disabled: boolean;
  onSelect: (visibility: DocumentVisibility) => void;
}) {
  const Icon = DOCUMENT_ACCESS_ICON[visibility];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onSelect(visibility)}
      className="-mx-1.5 flex w-[calc(100%+12px)] items-center gap-2.5 rounded-md px-2 py-[7px] text-start transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      <span
        aria-hidden
        className={cn(
          'size-4 shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_var(--color-input)] transition-shadow',
          checked && 'shadow-[inset_0_0_0_5px_var(--color-primary)]',
        )}
      />
    </button>
  );
}
