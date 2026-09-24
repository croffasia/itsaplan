'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Project } from '@/lib/api/endpoints/projects';
import { useProjectsQuery } from '@/services/projects.service';

// Sends a path from before project keys were unique per team (/project/MKT/…, /MKT-42,
// /issue/:id) to the one that replaced it. `resolve` finds the project among the
// viewer's own and builds the new path; a key two of their teams share, or one they
// do not reach, lands on the home page.
export default function LegacyRedirect({
  resolve,
}: {
  resolve: (projects: Project[]) => string | null | undefined;
}) {
  const t = useTranslations('common');
  const router = useRouter();
  const { data: projects } = useProjectsQuery();

  useEffect(() => {
    if (projects) router.replace(resolve(projects) ?? '/');
  }, [projects, resolve, router]);

  return (
    <div className="flex h-svh items-center justify-center bg-background text-sm text-muted-foreground">
      {t('loading')}
    </div>
  );
}
