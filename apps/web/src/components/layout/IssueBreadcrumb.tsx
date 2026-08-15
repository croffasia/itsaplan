import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { IssueRef } from '@/lib/api';
import { issuePath, projectPath } from '@/utils/paths';

// The header title on an issue page: project name › issue identifier, with the
// parent identifier in between when the issue is a subtask.
export default function IssueBreadcrumb({
  projectKey,
  projectName,
  identifier,
  parent,
}: {
  projectKey: string | null;
  projectName: string;
  identifier: string | null;
  parent: IssueRef | null;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Link
        href={projectKey ? projectPath(projectKey) : '/'}
        className="truncate text-muted-foreground hover:text-foreground"
      >
        {projectName}
      </Link>
      {parent && projectKey && (
        <>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" />
          <Link
            href={issuePath(projectKey, parent.sequenceNumber)}
            className="truncate text-muted-foreground hover:text-foreground"
          >
            {parent.identifier}
          </Link>
        </>
      )}
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" />
      <span className="truncate font-medium">{identifier ?? '…'}</span>
    </span>
  );
}
