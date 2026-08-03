import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Picks the part of the new issue body that is on screen. A dropdown rather than
// a row of tabs: a project can define enough body fields that the row runs past
// the dialog edge, and the ones past it cannot be reached.
export default function NewIssueBodySwitcher({
  sections,
  value,
  onChange,
}: {
  sections: { value: string; label: string; filled: boolean }[];
  value: string;
  onChange: (section: string) => void;
}) {
  const active = sections.find((s) => s.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* Kept quiet on purpose: the dialog title is the only heading that
            carries weight here. No padding either, so the label starts on the
            same line as the editor text under it. */}
        <button
          type="button"
          className="flex h-6 max-w-full min-w-0 items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
        >
          <span className="truncate">{active?.label}</span>
          <ChevronDown className="size-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
        {/* The check marks a section that has been written in, so the open one is
            marked by its background instead. */}
        {sections.map((s) => (
          <DropdownMenuItem
            key={s.value}
            onClick={() => onChange(s.value)}
            className={cn(s.value === value && 'bg-accent/50')}
          >
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            {s.filled && <Check className="size-4 shrink-0 text-green-500" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
