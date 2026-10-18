import { useState, type Ref } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectSort } from '@/lib/api/endpoints/projects';
import type { Team } from '@/lib/api/endpoints/teams';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Command, CommandInput, CommandList } from '@/components/ui/command';
import type { ProjectSwitcherScope } from './ProjectSwitcher';
import ProjectSwitcherRecent from './ProjectSwitcherRecent';
import ProjectSwitcherResults from './ProjectSwitcherResults';
import ProjectSwitcherSort from './ProjectSwitcherSort';

export default function ProjectSwitcherList({
  workspace,
  teams,
  scope,
  currentProjectKey,
  recentIds,
  sort,
  onSortChange,
  onSelectProject,
  inputRef,
}: {
  workspace?: WorkspaceSummary;
  teams: Team[];
  scope: ProjectSwitcherScope;
  currentProjectKey: string | null;
  recentIds: number[];
  sort: ProjectSort;
  onSortChange: (sort: ProjectSort) => void;
  onSelectProject: (key: string) => void;
  inputRef: Ref<HTMLInputElement>;
}) {
  const t = useTranslations('nav');
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim(), 250);
  const workspaceId = workspace?.id;
  const rowProps = {
    currentProjectKey,
    workspaceRole: workspace?.role ?? null,
    onSelectProject,
  };

  let content;
  if (q) {
    content = (
      <ProjectSwitcherResults
        filters={{ workspaceId, q, sort }}
        empty={t('projectPicker.noResults')}
        showTeam
        {...rowProps}
      />
    );
  } else if (scope === 'recent') {
    content = (
      <ProjectSwitcherRecent
        workspaceId={workspaceId}
        sort={sort}
        recentIds={recentIds}
        {...rowProps}
      />
    );
  } else if (scope === 'hidden') {
    content = (
      <ProjectSwitcherResults
        filters={{ workspaceId, hidden: true, sort }}
        empty={t('projectPicker.noHiddenProjects')}
        showTeam
        {...rowProps}
      />
    );
  } else {
    content = (
      <ProjectSwitcherResults
        filters={{ teamId: scope, hidden: false, sort }}
        heading={teams.find((team) => team.id === scope)?.name}
        empty={t('noProjects')}
        {...rowProps}
      />
    );
  }

  return (
    <Command
      shouldFilter={false}
      loop
      className="min-h-0 min-w-0 flex-1 rounded-none"
      label={t('projects')}
    >
      <div className="flex shrink-0 items-center gap-1 border-b pe-2 [&>[data-slot=command-input-wrapper]]:h-12 [&>[data-slot=command-input-wrapper]]:min-w-0 [&>[data-slot=command-input-wrapper]]:flex-1 [&>[data-slot=command-input-wrapper]]:border-0">
        <CommandInput
          ref={inputRef}
          value={query}
          onValueChange={setQuery}
          className="text-sm"
          placeholder={t('projectPicker.search')}
          aria-label={t('projectPicker.search')}
        />
        <ProjectSwitcherSort sort={sort} onSortChange={onSortChange} />
      </div>
      <CommandList className="max-h-none min-h-0 flex-1 p-1.5">{content}</CommandList>
    </Command>
  );
}
