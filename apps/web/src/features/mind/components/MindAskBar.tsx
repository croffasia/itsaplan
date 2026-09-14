import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Asking the memory a question is the same call an agent makes, and it is written
// to the recall log either way. `search` filters the list as you type; pressing
// Enter runs the recall so the answer, and the read, are recorded.
export default function MindAskBar({
  search,
  onSearchChange,
  onAsk,
  asking,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onAsk: (question: string) => void;
  asking: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && search.trim().length > 0) onAsk(search.trim());
          }}
          placeholder="Ask the mind: what is the close-rate target? what is the reply SLA?"
          className="h-11 pl-10"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-11"
        disabled={search.trim().length === 0 || asking}
        onClick={() => onAsk(search.trim())}
      >
        {asking && <Loader2 className="size-4 animate-spin" />}
        Recall
      </Button>
      {focused && (
        <p className="w-full text-xs text-muted-foreground">
          Recall returns the pinned facts first, then what matches — and records the read.
        </p>
      )}
    </div>
  );
}
