'use client';

import type { ReactNode } from 'react';
import { useSession } from '@/lib/auth-client';
import { useProjectsQuery } from '@/services/projects.service';

// The start of an account, a startup screen: due until the account has a project it has
// not hidden, the rule by which the index route opens a project instead of a start page;
// a list that fails to load counts as none. That page is its screen, so it covers nothing
// and the screens after it wait.
export default function StartupFirstProject({ next }: { next: ReactNode }) {
  const { data: session } = useSession();
  const { data: projects } = useProjectsQuery(Boolean(session));

  return projects?.some((project) => !project.isHidden) ? next : null;
}
