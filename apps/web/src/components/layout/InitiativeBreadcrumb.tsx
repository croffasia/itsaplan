import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { initiativesPath } from '@/utils/paths';
import InitiativeBreadcrumbName from '@/components/layout/InitiativeBreadcrumbName';

// The header title on an initiative page: Initiatives › initiative name.
export default function InitiativeBreadcrumb({
  projectKey,
  initiativeId,
}: {
  projectKey: string | null;
  initiativeId: number;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Link
        href={projectKey ? initiativesPath(projectKey) : '/'}
        className="truncate text-muted-foreground hover:text-foreground"
      >
        Initiatives
      </Link>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
      {projectKey && (
        <InitiativeBreadcrumbName initiativeId={initiativeId} projectKey={projectKey} />
      )}
    </span>
  );
}
