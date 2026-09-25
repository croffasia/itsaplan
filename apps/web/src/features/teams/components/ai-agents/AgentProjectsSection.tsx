import { FolderKanban } from 'lucide-react';
import type { TeamProjectOption } from '@/lib/api/endpoints/teams';
import type { AgentFormValue } from '../../utils/agentForm';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AgentCapabilityList } from './AgentCapabilityList';
import { AgentEmptyNotice } from './AgentEmptyNotice';
import { AgentFormSection } from './AgentFormSection';
import { useTranslations } from 'next-intl';

// The projects of the team the agent works in. Membership is what lets its key reach a
// project, so this is where an operator attaches and detaches one; an agent with none
// authenticates and reaches nothing.
export default function AgentProjectsSection({
  open,
  onOpenChange,
  value,
  onChange,
  projects,
  joinsNewProjects,
  onJoinsNewProjectsChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: AgentFormValue;
  onChange: (patch: Partial<AgentFormValue>) => void;
  projects: TeamProjectOption[];
  joinsNewProjects: boolean;
  // Undefined for a member who cannot change the team's defaults; the checkbox is hidden.
  onJoinsNewProjectsChange?: (on: boolean) => void;
}) {
  const t = useTranslations('teams.agents');

  function toggle(id: number, on: boolean) {
    onChange({
      projectIds: on
        ? [...new Set([...value.projectIds, id])]
        : value.projectIds.filter((x) => x !== id),
    });
  }

  return (
    <AgentFormSection
      open={open}
      onOpenChange={onOpenChange}
      icon={FolderKanban}
      title={t('projects')}
      hint={t('projectsHint')}
      headerRight={
        projects.length > 0 ? `${value.projectIds.length} / ${projects.length}` : undefined
      }
    >
      {onJoinsNewProjectsChange && (
        <label className="flex cursor-pointer items-start gap-2 border-b border-border/60 pb-4">
          <Checkbox
            className="mt-0.5"
            checked={joinsNewProjects}
            onCheckedChange={(v) => onJoinsNewProjectsChange(v === true)}
          />
          <span>
            <span className="text-sm">{t('joinNewProjects')}</span>
            <span className="block text-xs text-muted-foreground">{t('joinNewProjectsHint')}</span>
          </span>
        </label>
      )}
      {projects.length > 1 && (
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={value.projectIds.length === projects.length}
            onClick={() => onChange({ projectIds: projects.map((project) => project.id) })}
          >
            {t('selectAllProjects')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={value.projectIds.length === 0}
            onClick={() => onChange({ projectIds: [] })}
          >
            {t('clearProjects')}
          </Button>
        </div>
      )}
      {projects.length === 0 ? (
        <AgentEmptyNotice icon={FolderKanban} title={t('noProjects')} hint={t('noProjectsHint')} />
      ) : (
        <AgentCapabilityList
          searchPlaceholder={t('searchProjects')}
          onToggle={toggle}
          items={projects.map((project) => ({
            id: project.id,
            checked: value.projectIds.includes(project.id),
            title: project.name,
            subtitle: project.key,
            search: `${project.name} ${project.key}`.toLowerCase(),
          }))}
        />
      )}
    </AgentFormSection>
  );
}
