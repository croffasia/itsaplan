import { FolderKanban } from 'lucide-react';
import type { TeamProjectOption } from '@/lib/api/endpoints/teams';
import type { AgentFormValue } from '../../utils/agentForm';
import { Checkbox } from '@/components/ui/checkbox';
import { AgentEmptyNotice } from './AgentEmptyNotice';
import { AgentFormSection } from './AgentFormSection';
import { AgentPickList } from './AgentPickList';
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

  function toggle(ids: number[], on: boolean) {
    onChange({
      projectIds: on
        ? [...new Set([...value.projectIds, ...ids])]
        : value.projectIds.filter((x) => !ids.includes(x)),
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
        <label className="flex cursor-pointer items-center gap-2 border-b border-border/60 pb-4">
          <Checkbox
            checked={joinsNewProjects}
            onCheckedChange={(v) => onJoinsNewProjectsChange(v === true)}
          />
          <span>
            <span className="text-sm">{t('joinNewProjects')}</span>
            <span className="block text-xs text-muted-foreground">{t('joinNewProjectsHint')}</span>
          </span>
        </label>
      )}
      {projects.length === 0 ? (
        <AgentEmptyNotice icon={FolderKanban} title={t('noProjects')} hint={t('noProjectsHint')} />
      ) : (
        <AgentPickList
          items={projects.map((project) => ({
            id: project.id,
            name: project.name,
            note: project.key,
          }))}
          selected={value.projectIds}
          onToggle={toggle}
          heading={t('worksIn')}
          chooseLabel={t('chooseProjects')}
          noneText={t('noProjectsOn')}
          searchPlaceholder={t('searchProjects')}
          removeLabel={(name) => t('removeFromProject', { project: name })}
        />
      )}
    </AgentFormSection>
  );
}
