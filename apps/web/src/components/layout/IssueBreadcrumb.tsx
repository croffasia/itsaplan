import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { projectPath } from '@/utils/paths';

// The header title on an issue page: project name › issue identifier.
export default function IssueBreadcrumb({
  projectKey,
  projectName,
  identifier,
}: {
  projectKey: string | null;
  projectName: string;
  identifier: string | null;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Link
        href={projectKey ? projectPath(projectKey) : '/'}
        className="truncate text-muted-foreground hover:text-foreground"
      >
        {projectName}
      </Link>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate font-medium">{identifier ?? '…'}</span>
    </span>
  );
}
