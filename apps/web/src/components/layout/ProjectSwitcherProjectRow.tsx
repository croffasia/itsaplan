import { useTranslations } from 'next-intl';
import type { Project } from '@/lib/api/endpoints/projects';
import type { WorkspaceRole } from '@/lib/api/endpoints/workspaces';
import { cn } from '@/lib/utils';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { Badge } from '@/components/ui/badge';
import { CommandItem } from '@/components/ui/command';
import ProjectSwitcherRowMenu from './ProjectSwitcherRowMenu';
import ProjectSwitcherStarButton from './ProjectSwitcherStarButton';

export default function ProjectSwitcherProjectRow({
  project,
  currentProjectKey,
  onSelectProject,
  showTeam = false,
  workspaceRole = null,
}: {
  project: Project;
  currentProjectKey: string | null;
  onSelectProject: (key: string) => void;
  showTeam?: boolean;
  workspaceRole?: WorkspaceRole | null;
}) {
  const t = useTranslations('nav.projectPicker');
  const tw = useTranslations('teams.workspace');
  const current = project.ref === currentProjectKey;
  // Stars and hiding are kept on the membership, which a project reached through the
  // workspace does not have.
  const viaWorkspace = project.via === 'workspace';
  const relativeTime = useRelativeTime();
  const details = [
    showTeam && project.teamName,
    project.lastActivityAt && t('activeAgo', { time: relativeTime(project.lastActivityAt) }),
    viaWorkspace && workspaceRole && tw(`titles.${workspaceRole}`),
    project.isHidden && t('hiddenTag'),
  ].filter((detail): detail is string => Boolean(detail));

  return (
    <div className="group/row relative flex items-center gap-0.5 rounded-md pe-1 has-[[data-selected=true]]:bg-accent">
      {current && (
        <span
          aria-hidden
          className="absolute inset-y-2.5 start-0 w-0.5 rounded-full bg-foreground"
        />
      )}
      <CommandItem
        value={`project-${project.id}`}
        onSelect={() => onSelectProject(project.ref)}
        aria-current={current || undefined}
        className="min-w-0 flex-1 gap-3 py-2 ps-3 pe-2 data-[selected=true]:bg-transparent"
      >
        <span
          aria-hidden
          dir="ltr"
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[10px] font-medium tracking-wider text-foreground uppercase"
        >
          {project.key.slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              dir="auto"
              className={cn(
                'min-w-0 text-sm wrap-anywhere whitespace-normal',
                current ? 'font-semibold' : 'font-medium',
              )}
            >
              {project.name}
            </span>
            {current && (
              <Badge variant="secondary" className="shrink-0">
                {t('current')}
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span dir="ltr" className="font-mono text-[11px] tracking-wider uppercase">
              {project.key}
            </span>
            {details.map((detail) => (
              <span key={detail} className="contents">
                <span aria-hidden>·</span>
                <span dir="auto">{detail}</span>
              </span>
            ))}
          </div>
        </div>
      </CommandItem>
      {!viaWorkspace && !project.isHidden && <ProjectSwitcherStarButton project={project} />}
      {!viaWorkspace && <ProjectSwitcherRowMenu project={project} />}
    </div>
  );
}
