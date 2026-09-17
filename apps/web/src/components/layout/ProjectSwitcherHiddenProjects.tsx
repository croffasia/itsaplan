import { useId } from 'react';
import { Archive, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Project } from '@/lib/api/endpoints/projects';
import { Button } from '@/components/ui/button';
import { CommandGroup } from '@/components/ui/command';
import ProjectSwitcherProjectRow from './ProjectSwitcherProjectRow';

export default function ProjectSwitcherHiddenProjects({
  projects,
  hiddenCount,
  expanded,
  onExpandedChange,
  currentProjectKey,
  onSelectProject,
}: {
  projects: Project[];
  hiddenCount: number;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  currentProjectKey: string | null;
  onSelectProject: (key: string) => void;
}) {
  const t = useTranslations('nav.projectPicker');
  const sectionId = useId();

  return (
    <div className="mt-2 border-t pt-2">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        aria-expanded={expanded}
        aria-controls={sectionId}
        onKeyDown={(event) => event.stopPropagation()}
        onClick={() => onExpandedChange(!expanded)}
      >
        <Archive />
        {t('hiddenProjects', { count: hiddenCount })}
        <ChevronDown className={expanded ? 'ms-auto rotate-180' : 'ms-auto'} />
      </Button>
      {expanded && (
        <CommandGroup id={sectionId} aria-label={t('hiddenProjects', { count: hiddenCount })}>
          {projects.length === 0 && (
            <p role="status" className="px-2 py-4 text-xs text-muted-foreground">
              {t('noHiddenResults')}
            </p>
          )}
          {projects.map((project) => (
            <ProjectSwitcherProjectRow
              key={project.id}
              project={project}
              currentProjectKey={currentProjectKey}
              onSelectProject={onSelectProject}
            />
          ))}
        </CommandGroup>
      )}
    </div>
  );
}
