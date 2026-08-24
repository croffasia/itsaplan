import { ChevronsLeftRight, Pin, PinOff, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type IssueGroup } from '@/utils/project';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { GroupDot } from '../shared/GroupDot';
import { PINNED_COLUMN } from '../../utils/kanban';
import { type WipState, WIP_FULL_TEXT, wipFullColor } from '../../utils/wipLimit';

// A column collapsed to a narrow vertical strip. It keeps its position in column
// order, and shows its name vertically with its count. A collapse only releases the
// column's horizontal space.
export function CollapsedColumn({
  group,
  count,
  wip,
  pinned,
  onExpand,
  onTogglePin,
  onAddIssue,
  readOnly,
}: {
  group: IssueGroup;
  count: number;
  // The column's WIP limit. It is null when the column has no limit. The strip is
  // too narrow for the full `count / max`, so a full column only colours its count.
  wip: WipState | null;
  pinned: boolean;
  onExpand: () => void;
  onTogglePin: () => void;
  onAddIssue: () => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('workItems');
  const { can } = usePermissions();
  const canCreateIssue = can('work_items', 'create');
  return (
    <div
      className={cn(
        'flex h-full w-10 shrink-0 flex-col items-center gap-2 rounded-md bg-kanban-column py-2',
        pinned && PINNED_COLUMN,
      )}
    >
      {!readOnly && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground"
                onClick={onExpand}
                aria-label={t('expand')}
              >
                <ChevronsLeftRight />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('expand')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden size-6 text-muted-foreground md:inline-flex"
                onClick={onTogglePin}
                aria-label={pinned ? t('unpin') : t('pin')}
              >
                {pinned ? <PinOff /> : <Pin />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{pinned ? t('unpin') : t('pin')}</TooltipContent>
          </Tooltip>
          {canCreateIssue && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground"
                  onClick={onAddIssue}
                  aria-label={t('newIssue')}
                >
                  <Plus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('newIssue')}</TooltipContent>
            </Tooltip>
          )}
        </>
      )}
      <GroupDot group={group} />
      <div className="flex flex-1 items-start gap-2 text-sm font-medium [writing-mode:vertical-rl]">
        <span className="text-foreground">{group.name}</span>
        <span
          className={cn(wip?.full ? WIP_FULL_TEXT[wipFullColor(wip)] : 'text-muted-foreground')}
        >
          {count}
        </span>
      </div>
    </div>
  );
}
