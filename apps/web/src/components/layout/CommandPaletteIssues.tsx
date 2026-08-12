import { Hash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { IssueSearchHit } from '@/lib/api';
import { ISSUE_PREFIX } from '@/utils/commandFilter';
import { CommandGroup, CommandItem, CommandSeparator } from '@/components/ui/command';
import ArchivedBadge from '@/components/common/ArchivedBadge';

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
  const t = useTranslations('palette');
  return (
    <>
      <CommandSeparator />
      <CommandGroup heading={t('issues')}>
        {hits.length === 0 && fetching && (
          <CommandItem value={`${ISSUE_PREFIX}0`} disabled>
            <Hash />
            <span className="text-muted-foreground">{t('searching')}</span>
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
            {issue.archived && <ArchivedBadge />}
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {issue.identifier}
            </span>
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );
}
