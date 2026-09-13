import { Check, Clock3, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Project } from '@/lib/api/endpoints/projects';
import { formatDateTime } from '@/utils/dates';
import { Badge } from '@/components/ui/badge';
import { CommandItem } from '@/components/ui/command';
import ProjectSwitcherProjectActions from './ProjectSwitcherProjectActions';

export default function ProjectSwitcherProjectRow({
  project,
  currentProjectKey,
  onSelectProject,
}: {
  project: Project;
  currentProjectKey: string | null;
  onSelectProject: (key: string) => void;
}) {
  const t = useTranslations('nav.projectPicker');

  return (
    <div className="flex items-center gap-0.5">
      <CommandItem
        value={`project-${project.id}`}
        onSelect={() => onSelectProject(project.key)}
        className="min-w-0 flex-1 gap-2 p-2"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <span className="block text-sm wrap-anywhere whitespace-normal" dir="auto">
            {project.name}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <Badge
              variant="outline"
              className="max-w-full rounded px-1 py-0 font-mono text-[10px] wrap-anywhere whitespace-normal"
            >
              {project.key}
            </Badge>
            {project.isFavorite && (
              <Star className="size-3! fill-current" aria-label={t('starred')} />
            )}
            {project.lastActivityAt && (
              <span className="inline-flex items-center gap-1" title={t('activityHint')}>
                <Clock3 className="size-3!" />
                <time dateTime={project.lastActivityAt}>
                  {formatDateTime(project.lastActivityAt)}
                </time>
              </span>
            )}
          </span>
        </div>
        {project.key === currentProjectKey && <Check className="size-4 shrink-0" />}
      </CommandItem>
      <ProjectSwitcherProjectActions project={project} />
    </div>
  );
}
