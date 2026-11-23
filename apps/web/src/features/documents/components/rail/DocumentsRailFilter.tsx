import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import DocumentsRailMenuButton from './DocumentsRailMenuButton';

// A filter of the rail that shows its value and opens its choices in place.
export default function DocumentsRailFilter<T>({
  icon,
  label,
  value,
  options,
  open,
  onOpenChange,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (value: T) => void;
}) {
  const current = options.find((option) => option.value === value);
  return (
    <>
      <DocumentsRailMenuButton
        icon={icon}
        aria-expanded={open}
        trailing={
          <>
            <span className="max-w-28 truncate text-xs text-muted-foreground" dir="auto">
              {current?.label}
            </span>
            {open ? (
              <ChevronDown className="size-3.5!" />
            ) : (
              <ChevronRight className="size-3.5! rtl:rotate-180" />
            )}
          </>
        }
        onClick={() => onOpenChange(!open)}
      >
        {label}
      </DocumentsRailMenuButton>
      {open &&
        options.map((option) => (
          <DocumentsRailMenuButton
            key={String(option.value)}
            inset
            checked={option.value === value}
            onClick={() => onSelect(option.value)}
          >
            <span dir="auto">{option.label}</span>
          </DocumentsRailMenuButton>
        ))}
    </>
  );
}
