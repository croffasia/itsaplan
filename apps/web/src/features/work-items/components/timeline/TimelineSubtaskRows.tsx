import { CornerDownRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { issueColor, type Maps } from '@/utils/project';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSubtasks } from '../../context/useSubtasks';
import { effSpan, LINK_ROW_H } from '../../utils/timeline';

// The issue's subtasks as sub-rows under its timeline row: each subtask named on
// the left behind a nesting mark, with its own bar on the day track. How many are
// done is on the issue row itself (SubtaskProgress). A subtask has no row of its
// own, so the bars are read-only here as well — the dates are edited on the
// subtask itself — and a click opens it.
export function TimelineSubtaskRows({
  issueId,
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
  issueId: number;
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
  const t = useTranslations('workItems.timeline');
  const subtasks = useSubtasks(issueId);

  return (
    <>
      {subtasks.map((subtask, index) => {
        const span = effSpan(subtask);
        const rect = spanToRect(span.start, span.end);
        const column = maps.columnById.get(subtask.columnId);
        const done = column?.stateType === 'completed';
        return (
          <div
            key={subtask.id}
            className={cn(
              'flex border-b hover:bg-accent/20',
              // The last sub-row closes the block against the next issue row, so
              // it keeps the solid separator; the ones inside it are dashed.
              index < subtasks.length - 1 && 'border-dashed',
            )}
            style={{ height: LINK_ROW_H }}
          >
            <div
              className={cn(
                'sticky left-0 z-10 flex shrink-0 cursor-pointer items-center gap-2 overflow-hidden border-r bg-background pr-3 text-xs text-muted-foreground',
                indented ? 'pl-10' : 'pl-6',
              )}
              style={{ width: labelW }}
              onClick={() => onOpen(subtask.id)}
            >
              {/* Marks the row as nested under the issue row above: the sub-rows
                  are otherwise only indented, which reads as a link row. */}
              <CornerDownRight className="size-3 shrink-0 text-muted-foreground/60" />
              <span className="shrink-0 tabular-nums">{subtask.identifier}</span>
              <span className={cn('truncate', done && 'text-muted-foreground/60 line-through')}>
                {subtask.title}
              </span>
            </div>
            <div className="relative" style={{ width: trackWidth, ...dayLines }}>
              {todayInRange && (
                <div
                  className="absolute top-0 bottom-0 z-0 w-px bg-primary/40"
                  style={{ left: todayLeft }}
                />
              )}
              {/* Thinner than the issue bar, so the sub-rows read as one level
                  down without having to be greyed out. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    onClick={() => onOpen(subtask.id)}
                    className="absolute top-1/2 z-10 flex h-3.5 -translate-y-1/2 cursor-pointer items-center rounded-sm px-1.5 text-white opacity-80"
                    style={{
                      left: rect.left,
                      width: rect.width,
                      backgroundColor: issueColor(subtask, maps),
                      borderLeft: span.inferredStart
                        ? '2px dashed rgba(255,255,255,0.75)'
                        : undefined,
                    }}
                  >
                    <span className="truncate text-[10px] leading-none">{subtask.title}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {span.inferredStart ? t('inferredStart') : subtask.title}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        );
      })}
    </>
  );
}
