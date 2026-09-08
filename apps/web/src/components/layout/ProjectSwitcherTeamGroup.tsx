import { Check, ChevronRight, SquareKanban, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Project } from '@/lib/api/endpoints/projects';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

export interface TeamGroup {
  teamId: number;
  teamName: string;
  projects: Project[];
}

// One team's projects in the project switcher, foldable by its header. The open
// state is owned by the switcher, which outlives the menu's content.
export default function ProjectSwitcherTeamGroup({
  group,
  currentProjectKey,
  open,
  onOpenChange,
  onSelectProject,
}: {
  group: TeamGroup;
  currentProjectKey: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProject: (key: string) => void;
}) {
  const t = useTranslations('nav');

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      {/* A menu item rather than a plain button: only items take part in the
          dropdown's keyboard navigation. Selecting one closes the menu, which
          folding a team must not do. */}
      <CollapsibleTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className="gap-1.5 px-2 py-1.5 text-xs text-muted-foreground"
        >
          <ChevronRight className={cn('size-3 transition-transform', open && 'rotate-90')} />
          <Users className="size-3.5 shrink-0" />
          <span className="truncate font-medium">{group.teamName}</span>
          <span className="ms-auto flex shrink-0 items-center gap-1">
            <SquareKanban className="size-3.5" />
            <span className="tabular-nums">{group.projects.length}</span>
          </span>
        </DropdownMenuItem>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {group.projects.length === 0 && (
          <p className="py-2 ps-9 pe-2 text-xs text-muted-foreground">{t('noProjects')}</p>
        )}
        {group.projects.map((project) => (
          <DropdownMenuItem
            key={project.key}
            onClick={() => onSelectProject(project.key)}
            className="gap-2 p-2"
          >
            <Badge className="w-12 shrink-0 rounded px-1 py-0 font-mono text-[10px]">
              {project.key}
            </Badge>
            <span className="min-w-0 flex-1 truncate">{project.name}</span>
            {project.key === currentProjectKey && <Check className="size-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
