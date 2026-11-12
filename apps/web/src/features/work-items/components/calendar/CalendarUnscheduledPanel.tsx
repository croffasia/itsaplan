import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronsRightLeftIcon } from '@animateicons/react/lucide/chevrons-right-left-icon';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue } from '@/lib/api/endpoints/issues';
import type { DateField } from '@/utils/viewSettings';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ToolbarIconButton from '@/components/layout/ToolbarIconButton';
import { dateFieldWording, UNSCHEDULED_ID } from '../../utils/calendar';
import { CalendarDropZone } from './CalendarDropZone';
import { CalendarIssueCard } from './CalendarIssueCard';

// A card plus the gap under it.
const CARD_H = 38;

// The unscheduled panel — a drop target that clears an issue's date.
export function CalendarUnscheduledPanel({
  project,
  dateField,
  issues,
  dot,
  onOpen,
  onCollapse,
}: {
  project: ProjectDetail;
  dateField: DateField;
  issues: Issue[];
  dot: (issue: Issue) => string;
  onOpen: (id: number) => void;
  // Absent on a read-only share, which keeps the panel open.
  onCollapse?: () => void;
}) {
  const t = useTranslations('workItems.calendar');
  const tItems = useTranslations('workItems');
  const key = dateFieldWording(dateField);
  // Only the cards in and near the viewport are rendered: without dates, most of a
  // large project lands here, and the calendar renders the panel on every change.
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_H,
    overscan: 10,
    // A scroll step renders in a normal React update, not in flushSync inside the
    // scroll event, which blocks every scroll event on a slow CPU.
    useFlushSync: false,
    getItemKey: (index) => issues[index].id,
  });
  return (
    <CalendarDropZone
      id={UNSCHEDULED_ID}
      className="flex max-h-48 w-full shrink-0 flex-col border-t p-3 sm:max-h-none sm:w-64 sm:border-e sm:border-t-0"
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {t(`noDate.${key}`)}
        <span className="text-muted-foreground">{issues.length}</span>
        {onCollapse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <ToolbarIconButton
                icon={ChevronsRightLeftIcon}
                className="ms-auto p-1"
                onClick={onCollapse}
                aria-label={tItems('collapse')}
              />
            </TooltipTrigger>
            <TooltipContent>{tItems('collapse')}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div ref={scrollRef} className="overflow-y-auto">
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const issue = issues[vi.index];
            return (
              <div
                key={vi.key}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                className="absolute start-0 top-0 w-full pb-1"
                style={{ transform: `translateY(${vi.start}px)` }}
              >
                <CalendarIssueCard
                  project={project}
                  issue={issue}
                  color={dot(issue)}
                  onOpen={onOpen}
                />
              </div>
            );
          })}
        </div>
        {issues.length === 0 && (
          <span className="text-xs text-muted-foreground/50">{t(`allDated.${key}`)}</span>
        )}
      </div>
    </CalendarDropZone>
  );
}
