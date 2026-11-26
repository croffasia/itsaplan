import Link from 'next/link';
import { X } from 'lucide-react';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { IssueRef } from '@/lib/api/endpoints/issues';
import { issuePath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import PopoverPick from '@/components/common/fields/PopoverPick';
import ArchivedBadge from '@/components/common/ArchivedBadge';
import {
  historyScrollRestorationAnchorProps,
  historyScrollRestorationLinkProps,
} from '@/hooks/useHistoryScrollRestoration';
import { StateIcon } from '../shared/IssueIcons';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

// One other issue in the Links or Subtasks panel — the far end of a relation, a
// subtask, or the parent an issue hangs under — with its status icon, opening its
// page on click. The icon changes the status, the way the board's does. A done or
// canceled issue reads muted. onRemove and onChangeState are absent when the member
// cannot edit; removeLabel names what
// removing it does, for the screen reader. A public share has no issue pages to
// link to, so it passes onOpen and the row opens the issue where it stands; a
// share that cannot open it at all (a single shared issue) passes neither and the
// row only names it.
export default function IssueRefRow({
  project,
  issue,
  scrollAnchorKey,
  removeLabel,
  onRemove,
  onChangeState,
  onOpen,
  readOnly,
}: {
  project: ProjectDetail;
  issue: IssueRef;
  scrollAnchorKey: string;
  removeLabel: string;
  onRemove?: () => void;
  onChangeState?: (columnId: number) => void;
  onOpen?: () => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('issue.fieldSelects');
  const column = project.columns.find((c) => c.id === issue.columnId);
  const closed = column?.stateType === 'completed' || column?.stateType === 'canceled';
  const label = (
    <>
      <span className="text-[13px] text-muted-foreground/70 tabular-nums">{issue.identifier}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className={cn('truncate text-sm', closed && 'text-muted-foreground/70')}>
          {issue.title}
        </span>
        {issue.archived && <ArchivedBadge />}
      </span>
    </>
  );
  const labelClass = 'col-span-2 col-start-2 grid grid-cols-subgrid items-center';

  function renderName() {
    if (onOpen)
      return (
        <button type="button" onClick={onOpen} className={`${labelClass} text-start`}>
          {label}
        </button>
      );
    if (readOnly) return <div className={labelClass}>{label}</div>;
    return (
      <Link
        {...historyScrollRestorationLinkProps}
        {...historyScrollRestorationAnchorProps(scrollAnchorKey)}
        href={issuePath(project.project.ref, issue.sequenceNumber)}
        className={labelClass}
      >
        {label}
      </Link>
    );
  }

  const stateIcon = column && <StateIcon stateType={column.stateType} color={column.color} />;

  return (
    <div className="group col-span-full grid min-h-9 grid-cols-subgrid items-center rounded-md px-2 hover:bg-accent/50">
      {column &&
        (onChangeState ? (
          <PopoverPick
            align="start"
            inputPlaceholder={t('changeState')}
            emptyText={t('noState')}
            trigger={
              <button
                type="button"
                className="col-start-1 flex rounded-sm"
                title={column.name}
                aria-label={t('changeState')}
              >
                {stateIcon}
              </button>
            }
            items={project.columns.map((c) => ({
              key: String(c.id),
              search: c.name,
              icon: <StateIcon stateType={c.stateType} color={c.color} />,
              label: c.name,
              selected: c.id === column.id,
              onSelect: () => onChangeState(c.id),
            }))}
          />
        ) : (
          <span className="col-start-1 flex" title={column.name}>
            {stateIcon}
          </span>
        ))}
      {renderName()}
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="col-start-4 size-6 text-muted-foreground/70 opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 max-sm:opacity-100"
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
