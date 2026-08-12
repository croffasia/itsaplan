'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cyclesPath } from '@/utils/paths';
import { useCycleQuery } from '@/services/cycles.service';

// The header title on a cycle page: Cycles › cycle name. Renaming a cycle happens
// in its edit dialog, so the name here is plain text.
export default function CycleBreadcrumb({
  projectKey,
  cycleId,
}: {
  projectKey: string | null;
  cycleId: number;
}) {
  const t = useTranslations('nav');
  const name = useCycleQuery(cycleId).data?.name;

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Link
        href={projectKey ? cyclesPath(projectKey) : '/'}
        className="truncate text-muted-foreground hover:text-foreground"
      >
        {t('cycles')}
      </Link>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate font-medium">{name ?? '…'}</span>
    </span>
  );
}
