import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import PageSkeleton from '@/components/common/skeleton/PageSkeleton';

// The Shell's content area. It renders the routed page once the project is
// loaded, and stands in for it while loading, when the account has no projects
// yet, or when this project is not readable by the viewer.
export default function ShellBody({
  forbidden,
  hasProject,
  hasError,
  projectsLoaded,
  projectCount,
  children,
}: {
  forbidden: boolean;
  hasProject: boolean;
  hasError: boolean;
  projectsLoaded: boolean;
  projectCount: number;
  children: ReactNode;
}) {
  const t = useTranslations('shell');
  if (forbidden) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
        {t('noProjectAccess')}
      </div>
    );
  }
  // The routed page reads the project from the Shell context, so it is mounted
  // only once the project is there. A failed project keeps the body on a message;
  // the error itself is shown by the banner above. A loading one gets a skeleton of
  // the page it will become.
  if (!hasProject) {
    if (hasError)
      return (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
          {t('projectUnavailable')}
        </div>
      );
    if (projectsLoaded && projectCount === 0)
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {t('noProjects')}
        </div>
      );
    return <PageSkeleton />;
  }
  return <>{children}</>;
}
