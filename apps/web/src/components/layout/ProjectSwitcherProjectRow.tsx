import { useTranslations } from 'next-intl';
import type { Project } from '@/lib/api/endpoints/projects';
import { cn } from '@/lib/utils';
import { avatarColor } from '@/utils/avatar';
import { formatDateTime } from '@/utils/dates';
import { CommandItem } from '@/components/ui/command';
import ProjectSwitcherHideButton from './ProjectSwitcherHideButton';
import ProjectSwitcherStarButton from './ProjectSwitcherStarButton';

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
  const current = project.ref === currentProjectKey;

  return (
    <div className="group/row relative flex items-center gap-0.5 rounded-sm has-[[data-selected=true]]:bg-accent">
      {current && (
        <span aria-hidden className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-foreground" />
      )}
      <CommandItem
        value={`project-${project.id}`}
        onSelect={() => onSelectProject(project.ref)}
        aria-current={current || undefined}
        className="min-w-0 flex-1 gap-2.5 p-2 data-[selected=true]:bg-transparent"
      >
        <span
          dir="ltr"
          className={cn(
            'w-14 shrink-0 rounded-sm px-1 py-1 text-center font-mono font-semibold text-white',
            project.key.length > 7 ? 'text-[8px]' : 'text-[10px]',
          )}
          style={{ backgroundColor: avatarColor(project.key) }}
        >
          {project.key}
        </span>
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              'block text-sm wrap-anywhere whitespace-normal',
              current ? 'font-semibold' : 'font-medium',
            )}
            dir="auto"
          >
            {project.name}
          </span>
          {project.lastActivityAt && (
            <time
              dateTime={project.lastActivityAt}
              title={t('activityHint')}
              className="block text-xs text-muted-foreground"
            >
              {formatDateTime(project.lastActivityAt)}
            </time>
          )}
        </div>
      </CommandItem>
      <ProjectSwitcherHideButton project={project} />
      {!project.isHidden && <ProjectSwitcherStarButton project={project} />}
    </div>
  );
}
