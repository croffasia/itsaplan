import Link from 'next/link';
import { X } from 'lucide-react';
import { type IssueRef, type ProjectDetail } from '@/lib/api';
import { issuePath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import ArchivedBadge from '@/components/common/ArchivedBadge';
import { StateIcon } from '../shared/IssueIcons';

// One other issue in the Links or Subtasks panel — the far end of a relation, a
// subtask, or the parent an issue hangs under — with its status, opening its page
// on click. onRemove is absent when the member cannot edit; removeLabel names what
// removing it does, for the screen reader.
export default function IssueRefRow({
  project,
  issue,
  removeLabel,
  onRemove,
}: {
  project: ProjectDetail;
  issue: IssueRef;
  removeLabel: string;
  onRemove?: () => void;
}) {
  const column = project.columns.find((c) => c.id === issue.columnId);

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50">
      {column && <StateIcon stateType={column.stateType} color={column.color} />}
      <Link
        href={issuePath(project.project.key, issue.sequenceNumber)}
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{issue.identifier}</span>
        <span className="truncate text-sm">{issue.title}</span>
      </Link>
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
