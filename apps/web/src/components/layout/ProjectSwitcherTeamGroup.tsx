import { ChevronRight, SquareKanban, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ProjectSwitcherProjectRow from './ProjectSwitcherProjectRow';
import type { TeamGroup } from './utils/projectSwitcher';

export default function ProjectSwitcherTeamGroup({
  group,
  currentProjectKey,
  open,
  searching,
  onOpenChange,
  onSelectProject,
}: {
  group: TeamGroup;
  currentProjectKey: string | null;
  open: boolean;
  searching: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProject: (key: string) => void;
}) {
  const t = useTranslations('nav');

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          disabled={searching}
          onKeyDown={(event) => event.stopPropagation()}
          className="h-auto min-h-8 w-full justify-start gap-1.5 px-2 py-1.5 text-xs text-muted-foreground disabled:opacity-100"
        >
          <ChevronRight
            className={cn(
              'size-3 transition-transform rtl:rotate-180',
              open && 'rotate-90 rtl:rotate-90',
            )}
          />
          <Users className="size-3.5 shrink-0" />
          <span
            dir="auto"
            className="min-w-0 text-start font-medium wrap-anywhere whitespace-normal"
          >
            {group.teamName}
          </span>
          <span className="ms-auto flex shrink-0 items-center gap-1">
            <SquareKanban className="size-3.5" />
            <span className="tabular-nums">{group.projects.length}</span>
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {group.projects.length === 0 && (
          <p className="py-2 ps-9 pe-2 text-xs text-muted-foreground">{t('noProjects')}</p>
        )}
        {group.projects.map((project) => (
          <ProjectSwitcherProjectRow
            key={project.key}
            project={project}
            currentProjectKey={currentProjectKey}
            onSelectProject={onSelectProject}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
