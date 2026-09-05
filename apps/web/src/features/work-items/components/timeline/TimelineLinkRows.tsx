import { type IssueLinkRef } from '@/lib/api';
import { issueColor, type Maps } from '@/utils/project';
import { cn } from '@/lib/utils';
import { useLinkRelationLabel } from '@/hooks/useLinkRelationLabel';
import { useIssueLinks } from '../../context/useIssueLinks';
import { effSpan, LINK_ROW_H } from '../../utils/timeline';

// The issue's relations as sub-rows under its timeline row: the relation and the
// linked issue on the left, that issue's own bar on the day track. The bars are
// read-only — the linked issue has its own row to be dragged on — and a click
// opens it.
export function TimelineLinkRows({
  links: refs,
  indented,
  maps,
  labelW,
  trackWidth,
  dayLines,
  todayInRange,
  todayLeft,
  spanToRect,
  onOpen,
}: {
  links: IssueLinkRef[] | undefined;
  // Follows the parent row's indent, so the sub-rows stay nested under it.
  indented: boolean;
  maps: Maps;
  labelW: number;
  trackWidth: number;
  dayLines: { backgroundImage: string };
  todayInRange: boolean;
  todayLeft: number;
  spanToRect: (start: Date, end: Date) => { left: number; width: number };
  onOpen: (id: number) => void;
}) {
  const relationLabel = useLinkRelationLabel();
  const links = useIssueLinks(refs);

  return (
    <>
      {links.map((link, index) => {
        const span = effSpan(link.issue);
        const rect = spanToRect(span.start, span.end);
        // Relations are grouped by sort order, so only the first row of a run
        // names it; the rows under it read as the same relation.
        const named = links[index - 1]?.relation !== link.relation;
        return (
          <div
            key={link.id}
            className={cn(
              'flex border-b border-dashed hover:bg-accent/20',
              named && index > 0 && 'border-t',
            )}
            // Tailwind sets the border style on every side at once, and the row's
            // own separator stays dashed, so the group divider is solid here.
            style={{ height: LINK_ROW_H, borderTopStyle: 'solid' }}
          >
            <div
              className={cn(
                'sticky left-0 z-10 flex shrink-0 cursor-pointer items-center gap-2 overflow-hidden border-r bg-background pr-3 text-xs text-muted-foreground',
                indented ? 'pl-13' : 'pl-9',
              )}
              style={{ width: labelW }}
              onClick={(e) => {
                e.preventDefault();
                onOpen(link.issue.id);
              }}
            >
              {/* Fixed width so the identifiers stay in one column when a row
                  leaves its relation unnamed. */}
              <span className="w-20 shrink-0">{named && relationLabel(link.relation)}</span>
              <span className="shrink-0 tabular-nums">{link.issue.identifier}</span>
              <span className="min-w-0 flex-1 truncate">{link.issue.title}</span>
            </div>
            <div className="relative" style={{ width: trackWidth, ...dayLines }}>
              {todayInRange && (
                <div
                  className="absolute top-0 bottom-0 z-0 w-px bg-primary/40"
                  style={{ left: todayLeft }}
                />
              )}
              <div
                onClick={(e) => {
                  e.preventDefault();
                  onOpen(link.issue.id);
                }}
                className="absolute top-1/2 z-10 flex h-4 -translate-y-1/2 cursor-pointer items-center rounded px-1.5 text-white opacity-60"
                style={{
                  left: rect.left,
                  width: rect.width,
                  backgroundColor: issueColor(link.issue, maps),
                }}
              >
                <span className="truncate text-[10px] leading-none">{link.issue.title}</span>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
