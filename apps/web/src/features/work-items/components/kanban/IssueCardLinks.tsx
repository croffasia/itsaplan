import { type IssueLinkRef } from '@/lib/api';
import { type Maps } from '@/utils/project';
import { cn } from '@/lib/utils';
import { LINK_RELATION_ICONS } from '@/utils/issueLinks';
import { useLinkRelationLabel } from '@/hooks/useLinkRelationLabel';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIssueLinks } from '../../context/useIssueLinks';

// The issue's relations under its card: one row per relation, naming it on the
// left and the issue on the other end on the right, with that issue's state
// color. The whole row opens the issue it names rather than the card it sits on;
// without onOpen (the drag preview) the rows are inert. Renders nothing when the
// issue has no relations, so a card without any keeps its height.
export function IssueCardLinks({
  links: refs,
  maps,
  onOpen,
}: {
  links: IssueLinkRef[] | undefined;
  maps: Maps;
  onOpen?: (id: number) => void;
}) {
  const relationLabel = useLinkRelationLabel();
  const links = useIssueLinks(refs);
  if (links.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col border-t border-border/50 pt-1.5">
      {links.map((link, index) => {
        const Icon = LINK_RELATION_ICONS[link.relation];
        const column = maps.columnById.get(link.issue.columnId);
        // Relations are grouped by sort order, so only the first row of a run
        // names it; the rows under it read as the same relation.
        const named = links[index - 1]?.relation !== link.relation;
        return (
          // The divider sits on a wrapper, not on the row itself, so the row's
          // hover background keeps its own padding on every side.
          <div
            key={link.id}
            className={cn(
              'flex flex-col',
              named && index > 0 && 'mt-1 border-t border-border/40 pt-1',
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  // The card below starts a drag on pointerdown and opens itself
                  // on click; a link row must do neither.
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen?.(link.issue.id);
                  }}
                  className={cn(
                    '-mx-1 flex items-center justify-between gap-2 rounded px-1 py-0.5 text-left',
                    onOpen && 'cursor-pointer hover:bg-muted/70',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-[10px] tracking-wide text-muted-foreground/70">
                    {named && (
                      <>
                        {/* Being blocked is the one relation that holds the issue
                            up, so it is the one that reads as a warning. */}
                        <Icon
                          className={cn(
                            'size-3 shrink-0',
                            link.relation === 'blocked_by'
                              ? 'text-destructive/80'
                              : 'text-muted-foreground',
                          )}
                        />
                        {relationLabel(link.relation)}
                      </>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-foreground/80">
                    {column && (
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: column.color }}
                      />
                    )}
                    {link.issue.identifier}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {link.issue.title}
                {column && ` · ${column.name}`}
              </TooltipContent>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}
