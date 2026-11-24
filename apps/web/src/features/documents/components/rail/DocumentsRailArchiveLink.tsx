import { Archive } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { documentsArchivePath } from '@/utils/paths';

export default function DocumentsRailArchiveLink({
  projectKey,
  count,
  active,
}: {
  projectKey: string;
  count: number | null;
  active: boolean;
}) {
  const t = useTranslations('documents');
  return (
    <div className="shrink-0 p-2">
      <Link
        href={documentsArchivePath(projectKey)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-8 items-center gap-2.5 rounded-md ps-6.5 pe-2 text-sm text-muted-foreground transition-colors duration-100 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60',
          active && 'bg-accent font-medium text-foreground',
        )}
      >
        <Archive className="size-4 shrink-0" />
        {t('archivedPages')}
        {count !== null && <span className="ms-auto text-xs tabular-nums">{count}</span>}
      </Link>
    </div>
  );
}
