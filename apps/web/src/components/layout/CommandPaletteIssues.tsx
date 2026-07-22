import { Hash } from 'lucide-react';
import type { IssueSearchHit } from '@/lib/api';
import { ISSUE_PREFIX } from '@/utils/commandFilter';
import { CommandGroup, CommandItem, CommandSeparator } from '@/components/ui/command';

// The palette's "Issues" group. The list comes from the server (already filtered
// and ordered); the ISSUE_PREFIX value keeps cmdk from re-filtering it.
export default function CommandPaletteIssues({
  hits,
  fetching,
  onOpenIssue,
}: {
  hits: IssueSearchHit[];
  fetching: boolean;
  onOpenIssue: (sequenceNumber: number) => void;
}) {
  return (
    <>
      <CommandSeparator />
      <CommandGroup heading="Issues">
        {hits.length === 0 && fetching && (
          <CommandItem value={`${ISSUE_PREFIX}0`} disabled>
            <Hash />
            <span className="text-muted-foreground">Searching…</span>
          </CommandItem>
        )}
        {hits.map((issue, i) => (
          <CommandItem
            key={issue.id}
            value={`${ISSUE_PREFIX}${i}`}
            onSelect={() => onOpenIssue(issue.sequenceNumber)}
          >
            <Hash />
            <span className="flex-1 truncate">{issue.title}</span>
            {issue.archived && (
              <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase">
                Archived
              </span>
            )}
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {issue.identifier}
            </span>
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );
}
