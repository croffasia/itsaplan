import { type IssueLinkRef } from '@/lib/api';
import { type Maps } from '@/utils/project';
import { cn } from '@/lib/utils';
import { useLinkRelationLabel } from '@/hooks/useLinkRelationLabel';
import { StateIcon } from '@/features/issue/components/shared/IssueIcons';
import { useIssueLinks } from '../../context/useIssueLinks';

// The row's relations, as indented sub-rows under it: the relation, the linked
// issue's state, its identifier and title. A click opens the linked issue rather
// than the row's own one.
export function TableRowLinks({
  links: refs,
  maps,
  onOpenIssue,
}: {
  links: IssueLinkRef[] | undefined;
  maps: Maps;
  onOpenIssue: (id: number) => void;
}) {
  const relationLabel = useLinkRelationLabel();
  const links = useIssueLinks(refs);
  if (links.length === 0) return null;

  return (
    <div className="col-span-full flex flex-col pt-1 pl-6">
      {links.map((link, index) => {
        const column = maps.columnById.get(link.issue.columnId);
        // Relations are grouped by sort order, so only the first row of a run
        // names it; the rows under it read as the same relation.
        const named = links[index - 1]?.relation !== link.relation;
        return (
          // The divider sits on a wrapper so the row keeps its own padding.
          <div
            key={link.id}
            className={cn(
              'flex flex-col',
              named && index > 0 && 'mt-1 border-t border-border/40 pt-1',
            )}
          >
            <button
              type="button"
              className="flex min-w-0 items-center gap-2 rounded py-0.5 text-left text-xs text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onOpenIssue(link.issue.id);
              }}
            >
              <span className="w-24 shrink-0">{named && relationLabel(link.relation)}</span>
              {column && (
                <StateIcon
                  stateType={column.stateType}
                  color={column.color}
                  className="size-3.5 shrink-0"
                />
              )}
              <span className="shrink-0 tabular-nums">{link.issue.identifier}</span>
              <span className="truncate">{link.issue.title}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
