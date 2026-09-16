import { useState, type Ref } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Project } from '@/lib/api/endpoints/projects';
import type { Team } from '@/lib/api/endpoints/teams';
import { Command, CommandInput, CommandList } from '@/components/ui/command';
import ProjectSwitcherTeamGroup from './ProjectSwitcherTeamGroup';
import ProjectSwitcherHiddenProjects from './ProjectSwitcherHiddenProjects';
import { projectSwitcherSections, type ProjectSort } from './utils/projectSwitcher';

export default function ProjectSwitcherList({
  projects,
  teams,
  current,
  sort,
  showHidden,
  onShowHiddenChange,
  openTeams,
  onOpenTeam,
  onSelectProject,
  inputRef,
}: {
  projects: Project[];
  teams: Team[];
  current?: Project;
  sort: ProjectSort;
  showHidden: boolean;
  onShowHiddenChange: (show: boolean) => void;
  openTeams: Record<number, boolean>;
  onOpenTeam: (teamId: number, open: boolean) => void;
  onSelectProject: (key: string) => void;
  inputRef: Ref<HTMLInputElement>;
}) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const { visibleGroups: groups, hiddenProjects } = projectSwitcherSections(
    projects,
    teams,
    query,
    sort,
    locale,
  );
  const searching = query.trim().length > 0;
  const hiddenCount = projects.filter((project) => project.isHidden).length;

  return (
    <Command
      shouldFilter={false}
      loop
      className="min-h-0 flex-1 rounded-none"
      label={t('projects')}
    >
      <CommandInput
        ref={inputRef}
        value={query}
        onValueChange={setQuery}
        placeholder={t('projectPicker.search')}
        aria-label={t('projectPicker.search')}
      />
      <CommandList className="max-h-none min-h-0 flex-1 p-1">
        {groups.every((group) => group.projects.length === 0) && (
          <p role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">
            {searching ? t('projectPicker.noResults') : t('projectPicker.noVisibleProjects')}
          </p>
        )}
        {groups.map((group) => (
          <ProjectSwitcherTeamGroup
            key={group.teamId}
            group={group}
            currentProjectKey={current?.key ?? null}
            open={
              searching ||
              (openTeams[group.teamId] ??
                (group.teamId === current?.teamId ||
                  group.projects.some((project) => project.isFavorite)))
            }
            searching={searching}
            onOpenChange={(open) => onOpenTeam(group.teamId, open)}
            onSelectProject={onSelectProject}
          />
        ))}
        {(hiddenCount > 0 || showHidden) && (
          <ProjectSwitcherHiddenProjects
            projects={hiddenProjects}
            hiddenCount={hiddenCount}
            expanded={showHidden}
            onExpandedChange={onShowHiddenChange}
            currentProjectKey={current?.key ?? null}
            onSelectProject={onSelectProject}
          />
        )}
      </CommandList>
    </Command>
  );
}
