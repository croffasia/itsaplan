import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronsUpDown, UserPlus, Users } from 'lucide-react';
import type { Team } from '@/lib/api/endpoints/teams';
import type { Project } from '@/lib/api/endpoints/projects';
import { useTeamsQuery } from '@/services/teams.service';
import { manageTeamsPath } from '@/utils/paths';
import ItsAPlanMark from '@/components/brand/ItsAPlanMark';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import ProjectSwitcherTeamGroup, {
  type TeamGroup,
} from '@/components/layout/ProjectSwitcherTeamGroup';

// The projects grouped by the team that owns them. Every team the user belongs to
// gets a group, so one without projects is still listed; a project whose team the
// user is not a member of gets a group of its own.
function groupByTeam(projects: Project[], teams: Team[]): TeamGroup[] {
  const groups: TeamGroup[] = teams.map((team) => ({
    teamId: team.id,
    teamName: team.name,
    projects: [],
  }));
  projects.forEach((project) => {
    let group = groups.find((g) => g.teamId === project.teamId);
    if (!group) {
      group = { teamId: project.teamId, teamName: project.teamName, projects: [] };
      groups.push(group);
    }
    group.projects.push(project);
  });
  return groups;
}

// Project picker in the sidebar header, modeled on the shadcn TeamSwitcher.
export default function ProjectSwitcher({
  projects,
  currentProjectKey,
  onSelectProject,
  onNewTeam,
}: {
  projects: Project[];
  currentProjectKey: string | null;
  onSelectProject: (key: string) => void;
  onNewTeam: () => void;
}) {
  const t = useTranslations('nav');
  const { isMobile } = useSidebar();
  const teams = useTeamsQuery().data ?? [];
  const current = projects.find((b) => b.key === currentProjectKey);
  const groups = groupByTeam(projects, teams);
  // Which teams the user unfolded or folded away, over the default of only the
  // current project's team being open. Held here rather than in each group: the menu
  // unmounts its content when it closes, so the choice would not survive reopening.
  const [openTeams, setOpenTeams] = useState<Record<number, boolean>>({});

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              disabled={projects.length === 0}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <ItsAPlanMark className="size-9! shrink-0 text-sidebar-foreground" />
              <div className="grid flex-1 gap-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold tracking-tight">
                  {current?.name ?? t('noProjects')}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  {current && (
                    <span className="shrink-0 font-mono text-[10px] tracking-wider uppercase">
                      {current.key}
                    </span>
                  )}
                  <Users className="size-3 shrink-0" />
                  <span className="truncate">{current?.teamName ?? '—'}</span>
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-[300px] rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t('projects')}
            </DropdownMenuLabel>
            {groups.map((group) => (
              <ProjectSwitcherTeamGroup
                key={group.teamId}
                group={group}
                currentProjectKey={currentProjectKey}
                open={openTeams[group.teamId] ?? group.teamId === current?.teamId}
                onOpenChange={(open) => setOpenTeams((prev) => ({ ...prev, [group.teamId]: open }))}
                onSelectProject={onSelectProject}
              />
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onNewTeam} className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <UserPlus className="size-4" />
              </div>
              <span className="font-medium text-muted-foreground">{t('newTeam')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="gap-2 p-2">
              <Link href={manageTeamsPath()}>
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <Users className="size-4" />
                </div>
                <span className="font-medium text-muted-foreground">{t('manageTeams')}</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
