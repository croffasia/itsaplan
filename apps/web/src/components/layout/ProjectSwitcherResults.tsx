import { useTranslations } from 'next-intl';
import type { ProjectSearchFilters } from '@/lib/api/endpoints/projects';
import type { WorkspaceRole } from '@/lib/api/endpoints/workspaces';
import { useProjectSearchQuery } from '@/services/projects.service';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import ProjectSwitcherProjectRow from './ProjectSwitcherProjectRow';

export default function ProjectSwitcherResults({
  filters,
  heading,
  empty,
  showTeam,
  currentProjectKey,
  workspaceRole,
  onSelectProject,
}: {
  filters: ProjectSearchFilters;
  heading?: string;
  empty: string;
  showTeam?: boolean;
  currentProjectKey: string | null;
  workspaceRole: WorkspaceRole | null;
  onSelectProject: (key: string) => void;
}) {
  const t = useTranslations('nav.projectPicker');
  const search = useProjectSearchQuery(filters);
  const projects = search.data?.pages.flatMap((page) => page.items) ?? [];

  if (search.isSuccess && projects.length === 0) {
    return (
      <p role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  return (
    <CommandGroup heading={heading}>
      {projects.map((project) => (
        <ProjectSwitcherProjectRow
          key={project.id}
          project={project}
          currentProjectKey={currentProjectKey}
          onSelectProject={onSelectProject}
          showTeam={showTeam}
          workspaceRole={workspaceRole}
        />
      ))}
      {search.hasNextPage && (
        <CommandItem
          value="show-more"
          disabled={search.isFetchingNextPage}
          onSelect={() => void search.fetchNextPage()}
          className="justify-center py-2 text-muted-foreground"
        >
          {t('showMore')}
        </CommandItem>
      )}
    </CommandGroup>
  );
}
