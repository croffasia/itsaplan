import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';

// How many items a checklist has to hold before its filter box is worth showing.
export const SEARCH_THRESHOLD = 3;

// The filter box over a long checklist in the agent form (actions, skills, tools).
// It filters the list already on screen, it does not query the server.
export function AgentListSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const tCommon = useTranslations('common');
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 ps-9 pe-9 text-sm"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute end-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
          aria-label={tCommon('clearSearch')}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
