import type { ReactNode } from 'react';

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
  if (forbidden) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
        You do not have access to this project.
      </div>
    );
  }
  // The routed page reads the project from the Shell context, so it is mounted
  // only once the project is there. A missing or failed project keeps the body on
  // a message; the error itself is shown by the banner above.
  if (!hasProject) {
    if (hasError)
      return (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
          This project is not available.
        </div>
      );
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {projectsLoaded && projectCount === 0
          ? 'No projects yet, create one to get started.'
          : 'Loading…'}
      </div>
    );
  }
  return <>{children}</>;
}
