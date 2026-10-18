import { useTranslations } from 'next-intl';
import type { Project, ProjectSort } from '@/lib/api/endpoints/projects';
import type { WorkspaceRole } from '@/lib/api/endpoints/workspaces';
import { useProjectSearchQuery } from '@/services/projects.service';
import { CommandGroup } from '@/components/ui/command';
import ProjectSwitcherProjectRow from './ProjectSwitcherProjectRow';

export default function ProjectSwitcherRecent({
  workspaceId,
  sort,
  recentIds,
  currentProjectKey,
  workspaceRole,
  onSelectProject,
}: {
  workspaceId?: number;
  sort: ProjectSort;
  recentIds: number[];
  currentProjectKey: string | null;
  workspaceRole: WorkspaceRole | null;
  onSelectProject: (key: string) => void;
}) {
  const t = useTranslations('nav.projectPicker');
  const favorites = useProjectSearchQuery({ workspaceId, favorite: true, sort });
  const recent = useProjectSearchQuery(
    { workspaceId, ids: recentIds, favorite: false, hidden: false },
    recentIds.length > 0,
  );
  // Only the first page of stars: a team or a search lists the rest.
  const starred = favorites.data?.pages[0]?.items ?? [];
  const opened = [...(recent.data?.pages[0]?.items ?? [])].sort(
    (a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id),
  );
  const loaded = favorites.isSuccess && (recentIds.length === 0 || recent.isSuccess);

  if (loaded && starred.length + opened.length === 0) {
    return (
      <p role="status" className="px-6 py-8 text-center text-sm text-muted-foreground">
        {t('recentEmpty')}
      </p>
    );
  }

  const rows = (projects: Project[]) =>
    projects.map((project) => (
      <ProjectSwitcherProjectRow
        key={project.id}
        project={project}
        currentProjectKey={currentProjectKey}
        onSelectProject={onSelectProject}
        showTeam
        workspaceRole={workspaceRole}
      />
    ));

  return (
    <>
      {starred.length > 0 && <CommandGroup heading={t('starred')}>{rows(starred)}</CommandGroup>}
      {opened.length > 0 && (
        <CommandGroup heading={t('recentlyOpened')}>{rows(opened)}</CommandGroup>
      )}
    </>
  );
}
