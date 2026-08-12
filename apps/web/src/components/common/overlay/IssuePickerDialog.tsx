import { useState } from 'react';
import { Hash } from 'lucide-react';
import { type IssueSearchHit } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useIssueSearchQuery } from '@/services/issues.service';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import ArchivedBadge from '@/components/common/ArchivedBadge';
import { useTranslations } from 'next-intl';

// Picks one of the project's issues, searched server-side (archived included).
// `exclude` drops the issues this particular pick cannot accept, so only the
// choices the caller can act on are offered.
export default function IssuePickerDialog({
  projectKey,
  title,
  prompt,
  exclude,
  onPick,
  onClose,
}: {
  projectKey: string;
  title: string;
  prompt: string;
  exclude?: (hit: IssueSearchHit) => boolean;
  onPick: (hit: IssueSearchHit) => void;
  onClose: () => void;
}) {
  const t = useTranslations('issue.linkDialog');
  const [query, setQuery] = useState('');

  // One request per burst of keystrokes, as in the command palette.
  const debounced = useDebouncedValue(query, 250);
  const search = useIssueSearchQuery(projectKey, debounced, { enabled: true });
  const hits = (search.data ?? []).filter((hit) => !exclude?.(hit));

  return (
    // The results are already filtered and ordered by the server, so cmdk must not
    // filter them again.
    <CommandDialog
      open
      onOpenChange={onClose}
      shouldFilter={false}
      title={title}
      description={prompt}
    >
      <CommandInput placeholder={prompt} value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>{query.trim() ? t('noMatches') : t('typeToSearch')}</CommandEmpty>
        <CommandGroup>
          {hits.map((hit) => (
            <CommandItem key={hit.id} value={String(hit.id)} onSelect={() => onPick(hit)}>
              <Hash />
              <span className="flex-1 truncate">{hit.title}</span>
              {hit.archived && <ArchivedBadge />}
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {hit.identifier}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
