import { ChevronsLeftRightIcon } from '@animateicons/react/lucide/chevrons-left-right-icon';
import { PinIcon } from '@animateicons/react/lucide/pin-icon';
import { PinOffIcon } from '@animateicons/react/lucide/pin-off-icon';
import { PlusIcon } from '@animateicons/react/lucide/plus-icon';
import { useTranslations } from 'next-intl';
import { type IssueGroup } from '@/utils/project';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { GroupDot } from '../shared/GroupDot';
import { HeaderIconButton } from '../shared/HeaderIconButton';
import { PINNED_COLUMN } from '../../utils/kanban';
import { type WipState, WIP_FULL_TEXT, wipAllows, wipFullColor } from '../../utils/wipLimit';

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
  const canCreateIssue = can('work_items', 'create') && group.assign != null && wipAllows(wip, 1);
  return (
    <div
      className={cn(
        'flex h-full w-10 shrink-0 flex-col items-center gap-2 rounded-md bg-kanban-column py-2',
        pinned && PINNED_COLUMN,
      )}
    >
      {!readOnly && (
        <>
          <HeaderIconButton icon={ChevronsLeftRightIcon} label={t('expand')} onClick={onExpand} />
          <HeaderIconButton
            icon={pinned ? PinOffIcon : PinIcon}
            label={pinned ? t('unpin') : t('pin')}
            onClick={onTogglePin}
            className="hidden md:inline-flex"
          />
          {canCreateIssue && (
            <HeaderIconButton icon={PlusIcon} label={t('newIssue')} onClick={onAddIssue} />
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
