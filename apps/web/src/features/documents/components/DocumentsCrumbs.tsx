import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { documentsPath } from '@/utils/paths';

const separator = (
  <ChevronRight
    className="size-3.5 shrink-0 text-muted-foreground/60 max-md:hidden rtl:rotate-180"
    aria-hidden
  />
);

// Project › Docs › the screen. A narrow screen keeps only the screen's own name.
export default function DocumentsCrumbs({
  projectKey,
  current,
}: {
  projectKey: string;
  current?: string;
}) {
  const t = useTranslations('documents');
  const { project } = useShell();
  const currentClass = 'truncate px-1.5 py-0.5 font-medium';

  return (
    <nav className="flex min-w-0 items-center gap-0.5 text-[13px]" aria-label={t('breadcrumb')}>
      {project && (
        <>
          <span
            className="max-w-40 truncate px-1.5 py-0.5 text-muted-foreground max-md:hidden"
            dir="auto"
          >
            {project.project.name}
          </span>
          {separator}
        </>
      )}
      {current ? (
        <>
          <Link
            href={documentsPath(projectKey)}
            className="rounded-sm px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground max-md:hidden"
          >
            {t('title')}
          </Link>
          {separator}
          <span className={currentClass} aria-current="page">
            {current}
          </span>
        </>
      ) : (
        <span className={currentClass} aria-current="page">
          {t('title')}
        </span>
      )}
    </nav>
  );
}
