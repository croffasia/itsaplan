import type { ReactNode } from 'react';

// The title and description block at the top of a page body. Shared by the page
// containers (SectionPageView, FullPageView). `actions` renders on the right of the
// header row, aligned with the title (e.g. a page-level primary button), and under it
// on a narrow screen.
export default function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {actions && (
        <div className="flex gap-2 sm:shrink-0 [&>button]:flex-1 sm:[&>button]:flex-none">
          {actions}
        </div>
      )}
    </header>
  );
}
