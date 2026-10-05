import { useTranslations } from 'next-intl';
import type { Project } from '@/lib/api/endpoints/projects';
import type { WorkspaceRole } from '@/lib/api/endpoints/workspaces';
import { cn } from '@/lib/utils';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { CommandItem } from '@/components/ui/command';
import ProjectSwitcherHideButton from './ProjectSwitcherHideButton';
import ProjectSwitcherStarButton from './ProjectSwitcherStarButton';

export default function ProjectSwitcherProjectRow({
  project,
  currentProjectKey,
  onSelectProject,
  workspaceRole = null,
}: {
  project: Project;
  currentProjectKey: string | null;
  onSelectProject: (key: string) => void;
  workspaceRole?: WorkspaceRole | null;
}) {
  const t = useTranslations('nav.projectPicker');
  const tw = useTranslations('teams.workspace');
  const current = project.ref === currentProjectKey;
  // Stars and hiding are kept on the membership, which a project reached through the
  // workspace does not have.
  const viaWorkspace = project.via === 'workspace';
  const relativeTime = useRelativeTime();

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
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <span dir="ltr" className="shrink-0 font-mono text-[10px] tracking-wider uppercase">
              {project.key}
            </span>
            {project.lastActivityAt && (
              <>
                <span aria-hidden>·</span>
                <time dateTime={project.lastActivityAt}>
                  {t('activeAgo', { time: relativeTime(project.lastActivityAt) })}
                </time>
              </>
            )}
            {viaWorkspace && workspaceRole && (
              <>
                <span aria-hidden>·</span>
                <span>{tw(`titles.${workspaceRole}`)}</span>
              </>
            )}
          </span>
        </div>
      </CommandItem>
      {!viaWorkspace && <ProjectSwitcherHideButton project={project} />}
      {!viaWorkspace && !project.isHidden && <ProjectSwitcherStarButton project={project} />}
    </div>
  );
}
