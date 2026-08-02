import { useEffect, useState } from 'react';
import { Hash } from 'lucide-react';
import { type IssueLinkInputKind, type ProjectDetail } from '@/lib/api';
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
import { LINK_RELATION_LABELS, LINK_RELATION_PHRASES } from '@/utils/issueLinks';
import { useLinkIssues } from '../../services/links.service';

// Searches for the issue on the other end of a new relation, server-side across
// the project (archived included). The relation itself is already chosen — the
// panel's Add menu picks it. linkedIssueIds are the issues this relation would be
// a second copy of, dropped from the results so only the picks the API accepts
// are offered.
export default function IssueLinkDialog({
  project,
  issueId,
  relation,
  linkedIssueIds,
  onClose,
}: {
  project: ProjectDetail;
  issueId: number;
  relation: IssueLinkInputKind;
  linkedIssueIds: Set<number>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const linkIssues = useLinkIssues();

  // A relation picked again starts a fresh search.
  useEffect(() => {
    setQuery('');
    setError(null);
  }, [relation]);

  // One request per burst of keystrokes, as in the command palette.
  const debounced = useDebouncedValue(query, 250);
  const search = useIssueSearchQuery(project.project.key, debounced, { enabled: true });
  const hits = (search.data ?? []).filter((h) => h.id !== issueId && !linkedIssueIds.has(h.id));
  const prompt = `Search issues this one is ${LINK_RELATION_PHRASES[relation]}…`;

  async function pick(targetIssueId: number) {
    setError(null);
    try {
      await linkIssues.mutateAsync({
        projectKey: project.project.key,
        issueId,
        otherIssueId: targetIssueId,
        kind: relation,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link the issues');
    }
  }

  return (
    // The results are already filtered and ordered by the server, so cmdk must not
    // filter them again.
    <CommandDialog
      open
      onOpenChange={onClose}
      shouldFilter={false}
      title={`Link an issue: ${LINK_RELATION_LABELS[relation]}`}
      description={prompt}
    >
      <CommandInput placeholder={prompt} value={query} onValueChange={setQuery} />

      {error && <p className="px-3 py-2 text-xs text-destructive">{error}</p>}

      <CommandList>
        <CommandEmpty>
          {query.trim() ? 'No issues match.' : 'Type to search this project’s issues.'}
        </CommandEmpty>
        <CommandGroup>
          {hits.map((hit) => (
            <CommandItem key={hit.id} value={String(hit.id)} onSelect={() => void pick(hit.id)}>
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
