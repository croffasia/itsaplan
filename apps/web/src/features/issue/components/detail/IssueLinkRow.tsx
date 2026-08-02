import Link from 'next/link';
import { X } from 'lucide-react';
import { type IssueLink, type ProjectDetail } from '@/lib/api';
import { issuePath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import ArchivedBadge from '@/components/common/ArchivedBadge';
import { StateIcon } from '../shared/IssueIcons';

// One relation in the Links panel: the issue on the other end, with its status,
// opening its page on click. onRemove is absent when the member cannot edit.
export default function IssueLinkRow({
  project,
  link,
  onRemove,
}: {
  project: ProjectDetail;
  link: IssueLink;
  onRemove?: () => void;
}) {
  const column = project.columns.find((c) => c.id === link.issue.columnId);

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50">
      {column && <StateIcon stateType={column.stateType} color={column.color} />}
      <Link
        href={issuePath(project.project.key, link.issue.sequenceNumber)}
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {link.issue.identifier}
        </span>
        <span className="truncate text-sm">{link.issue.title}</span>
      </Link>
      {link.issue.archived && <ArchivedBadge />}
      {column && <span className="shrink-0 text-xs text-muted-foreground">{column.name}</span>}
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
          aria-label={`Remove the link to ${link.issue.identifier}`}
          onClick={onRemove}
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
