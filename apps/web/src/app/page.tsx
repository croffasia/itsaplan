'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SquareKanban, Users } from 'lucide-react';
import { useProjectsQuery } from '@/services/projects.service';
import { useTeamsQuery } from '@/services/teams.service';
import { useAccountPreferencesQuery } from '@/services/preferences.service';
import { startPagePath, projectPath } from '@/utils/paths';
import NewProjectModal from '@/components/layout/NewProjectModal';
import NewTeamModal from '@/features/teams/components/NewTeamModal';
import ProjectSwitcherHiddenState from '@/components/layout/ProjectSwitcherHiddenState';
import StartEmpty from '@/components/layout/StartEmpty';

// The index route: reopen the last-used project if it still exists, otherwise the
// first visible favorite or project, on the user's preferred start page. Waits for both
// the project list and the preferences before deciding so it does not flash the
// wrong destination. With no projects at all, an account that owns or manages a team
// is offered to create the first one there, and any other to create its own team — a
// plain member is also told who adds them to the team's projects.
export default function Home() {
  const t = useTranslations('shell');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { data: teams } = useTeamsQuery();
  const { data: projects } = useProjectsQuery();
  const { data: prefs, isPending: prefsPending } = useAccountPreferencesQuery();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (projects == null || projects.length === 0 || prefsPending) return;
    const visible = projects.filter((project) => !project.isHidden);
    if (visible.length === 0) return;
    const last = visible.find((p) => p.id === prefs?.lastProjectId);
    const target = last?.ref ?? visible.find((p) => p.isFavorite)?.ref ?? visible[0]?.ref;
    if (target) router.replace(startPagePath(target, prefs?.startPage ?? 'work-items'));
  }, [projects, prefs, prefsPending, router]);

  if (projects && projects.length > 0 && projects.every((project) => project.isHidden)) {
    return <ProjectSwitcherHiddenState projects={projects} />;
  }

  const managedTeam = teams?.find((one) => one.role !== 'member');

  if (teams && !managedTeam && projects?.length === 0) {
    return (
      <StartEmpty
        icon={<Users />}
        title={teams.length === 0 ? t('noTeamsTitle') : t('noProjectsTitle')}
        hint={teams.length === 0 ? t('noTeamsHint') : t('noProjectAccessHint')}
        action={t('createTeam')}
        onAction={() => setCreating(true)}
      >
        {creating && <NewTeamModal onClose={() => setCreating(false)} />}
      </StartEmpty>
    );
  }

  // No projects yet: the Shell (which owns the New project modal) never mounts
  // without a project, so the empty state offers project creation directly.
  if (managedTeam && projects?.length === 0) {
    return (
      <StartEmpty
        icon={<SquareKanban />}
        title={t('noProjectsTitle')}
        hint={t('noProjectsHint')}
        action={t('createProject')}
        onAction={() => setCreating(true)}
      >
        {creating && (
          <NewProjectModal
            teamId={managedTeam.id}
            onClose={() => setCreating(false)}
            onCreated={(key) => {
              setCreating(false);
              router.push(projectPath(key));
            }}
          />
        )}
      </StartEmpty>
    );
  }

  return (
    <div className="flex h-svh items-center justify-center bg-background text-sm text-muted-foreground">
      {tCommon('loading')}
    </div>
  );
}
