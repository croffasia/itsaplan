import { useIconHover } from '@animateicons/react';
import { ChevronDownIcon } from '@animateicons/react/lucide/chevron-down-icon';
import { ChevronRightIcon } from '@animateicons/react/lucide/chevron-right-icon';
import { ListTreeIcon } from '@animateicons/react/lucide/list-tree-icon';
import { useTranslations } from 'next-intl';
import { type Maps } from '@/utils/project';
import { subtaskProgress } from '@/utils/subtasks';
import { noDragProps } from '@/lib/dnd';
import { useSubtaskFold, useSubtasks } from '../../context/useSubtasks';
import { IssueCardSubtaskRow } from './IssueCardSubtaskRow';

export function IssueCardSubtasks({
  issueId,
  maps,
  onOpen,
}: {
  issueId: number;
  maps: Maps;
  onOpen?: (id: number) => void;
}) {
  const t = useTranslations('workItems');
  const subtasks = useSubtasks(issueId);
  const { open, toggle } = useSubtaskFold();
  const hover = useIconHover({
    trigger: [
      { icon: 'chevron', trigger: 'hover' },
      { icon: 'list', trigger: 'hover' },
    ],
  });
  if (subtasks.length === 0) return null;
  const progress = subtaskProgress(subtasks, maps.columnById);
  const Chevron = open ? ChevronDownIcon : ChevronRightIcon;

  return (
    <div
      className="mt-2 flex flex-col gap-1 border-t border-border/50 pt-1.5"
      onKeyDown={(event) => {
        // The card's keyboard drag sensor listens for the same keys as the buttons.
        if (event.code === 'Enter' || event.code === 'Space') event.stopPropagation();
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        {...noDragProps}
        {...hover.trigger}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          toggle();
        }}
        className="-mx-1.5 flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] tracking-wide text-muted-foreground/70 hover:bg-muted/70 hover:text-foreground"
      >
        <Chevron {...hover.icon.chevron} size={12} className="shrink-0 text-muted-foreground" />
        <ListTreeIcon {...hover.icon.list} size={12} className="shrink-0 text-muted-foreground" />
        {t('subtasksProgress', { done: progress.done, total: progress.total })}
        <span className="ms-auto h-0.5 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-muted-foreground/50"
            style={{
              width: `${progress.total === 0 ? 0 : (progress.done / progress.total) * 100}%`,
            }}
          />
        </span>
      </button>
      {open &&
        subtasks.map((subtask) => (
          <IssueCardSubtaskRow key={subtask.id} subtask={subtask} maps={maps} onOpen={onOpen} />
        ))}
    </div>
  );
}
