'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, SquareKanban } from 'lucide-react';
import { useProjectsQuery } from '@/services/projects.service';
import { useAccountPreferencesQuery } from '@/services/preferences.service';
import { startPagePath, projectPath } from '@/utils/paths';
import NewProjectModal from '@/components/layout/NewProjectModal';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

// The index route: reopen the last-used project if it still exists, otherwise the
// first project, on the section the user picked as their start page. Waits for both
// the project list and the preferences before deciding so it does not flash the
// wrong destination. With no projects at all, offers to create the first one.
export default function Home() {
  const router = useRouter();
  const { data: projects } = useProjectsQuery();
  const { data: prefs, isPending: prefsPending } = useAccountPreferencesQuery();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (projects == null || projects.length === 0 || prefsPending) return;
    // The remembered project only counts while the user still has access to it: the
    // list holds their projects only, so a deleted or revoked one falls to the first.
    const last = projects.find((p) => p.id === prefs?.lastProjectId);
    const target = last?.key ?? projects[0]?.key;
    if (target) router.replace(startPagePath(target, prefs?.startPage ?? 'work-items'));
  }, [projects, prefs, prefsPending, router]);

  // No projects yet: the Shell (which owns the New project modal) never mounts
  // without a project, so the empty state offers project creation directly.
  if (projects && projects.length === 0) {
    return (
      <div className="flex h-svh items-center justify-center p-6">
        <Empty className="max-w-md">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SquareKanban />
            </EmptyMedia>
            <EmptyTitle>No projects yet</EmptyTitle>
            <EmptyDescription>
              Create your first project to start planning issues on a board.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setCreating(true)}>
              <Plus />
              Create project
            </Button>
          </EmptyContent>
        </Empty>

        {creating && (
          <NewProjectModal
            onClose={() => setCreating(false)}
            onCreated={(key) => {
              setCreating(false);
              router.push(projectPath(key));
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-svh items-center justify-center bg-background text-sm text-muted-foreground">
      Loading…
    </div>
  );
}
