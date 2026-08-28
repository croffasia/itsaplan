import Link from 'next/link';
import { X } from 'lucide-react';
import { type IssueRef, type ProjectDetail } from '@/lib/api';
import { issuePath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import ArchivedBadge from '@/components/common/ArchivedBadge';
import {
  historyScrollRestorationAnchorProps,
  historyScrollRestorationLinkProps,
} from '@/hooks/useHistoryScrollRestoration';
import { StateIcon } from '../shared/IssueIcons';

// One other issue in the Links or Subtasks panel — the far end of a relation, a
// subtask, or the parent an issue hangs under — with its status, opening its page
// on click. onRemove is absent when the member cannot edit; removeLabel names what
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
  onOpen,
  readOnly,
}: {
  project: ProjectDetail;
  issue: IssueRef;
  scrollAnchorKey: string;
  removeLabel: string;
  onRemove?: () => void;
  onOpen?: () => void;
  readOnly?: boolean;
}) {
  const column = project.columns.find((c) => c.id === issue.columnId);
  const label = (
    <>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">{issue.identifier}</span>
      <span className="truncate text-sm">{issue.title}</span>
    </>
  );
  const labelClass = 'flex min-w-0 flex-1 items-center gap-2';

  function renderName() {
    if (onOpen)
      return (
        <button type="button" onClick={onOpen} className={`${labelClass} text-left`}>
          {label}
        </button>
      );
    if (readOnly) return <div className={labelClass}>{label}</div>;
    return (
      <Link
        {...historyScrollRestorationLinkProps}
        {...historyScrollRestorationAnchorProps(scrollAnchorKey)}
        href={issuePath(project.project.key, issue.sequenceNumber)}
        className={labelClass}
      >
        {label}
      </Link>
    );
  }

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50">
      {column && <StateIcon stateType={column.stateType} color={column.color} />}
      {renderName()}
      {issue.archived && <ArchivedBadge />}
      {column && <span className="shrink-0 text-xs text-muted-foreground">{column.name}</span>}
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
