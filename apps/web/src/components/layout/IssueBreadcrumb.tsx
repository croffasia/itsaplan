import { Fragment } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { IssueRef } from '@/lib/api/endpoints/issues';
import { issuePath, projectPath } from '@/utils/paths';
import IssueSavedNote from '@/components/common/IssueSavedNote';

// The header title on an issue page: project name › issue identifier, with the
// identifiers of every issue above it in between when the issue is a subtask.
export default function IssueBreadcrumb({
  projectKey,
  projectName,
  identifier,
  issueId,
  ancestors,
}: {
  projectKey: string | null;
  projectName: string;
  identifier: string | null;
  issueId: number | null;
  ancestors: IssueRef[];
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Link
        href={projectKey ? projectPath(projectKey) : '/'}
        className="truncate text-muted-foreground hover:text-foreground"
      >
        {projectName}
      </Link>
      {projectKey &&
        ancestors.map((ancestor) => (
          <Fragment key={ancestor.id}>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" />
            <Link
              href={issuePath(projectKey, ancestor.sequenceNumber)}
              className="truncate text-muted-foreground hover:text-foreground"
            >
              {ancestor.identifier}
            </Link>
          </Fragment>
        ))}
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" />
      <span className="truncate font-medium">{identifier ?? '…'}</span>
      {issueId != null && <IssueSavedNote issueId={issueId} className="ms-1 shrink-0" />}
    </span>
  );
}
