import type { ReactNode } from 'react';
import { Hash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { IssueSearchHit } from '@/lib/api/endpoints/issues';
import { ISSUE_PREFIX } from '@/utils/commandFilter';
import { CommandGroup, CommandItem, CommandSeparator } from '@/components/ui/command';
import ArchivedBadge from '@/components/common/ArchivedBadge';

// A palette group of issue hits. The list comes from the server (already filtered
// and ordered); the ISSUE_PREFIX value keeps cmdk from re-filtering it. A later
// group starts its values at valueOffset, so the values stay unique and it sorts
// below the groups before it.
export default function CommandPaletteIssues<T extends IssueSearchHit>({
  heading,
  hits,
  fetching,
  valueOffset = 0,
  onOpenIssue,
}: {
  heading: ReactNode;
  hits: T[];
  fetching: boolean;
  valueOffset?: number;
  onOpenIssue: (hit: T) => void;
}) {
  const t = useTranslations('palette');
  return (
    <>
      <CommandSeparator />
      <CommandGroup heading={heading}>
        {hits.length === 0 && fetching && (
          <CommandItem value={`${ISSUE_PREFIX}${valueOffset}`} disabled>
            <Hash />
            <span className="text-muted-foreground">{t('searching')}</span>
          </CommandItem>
        )}
        {hits.map((issue, i) => (
          <CommandItem
            key={issue.id}
            value={`${ISSUE_PREFIX}${valueOffset + i}`}
            onSelect={() => onOpenIssue(issue)}
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
