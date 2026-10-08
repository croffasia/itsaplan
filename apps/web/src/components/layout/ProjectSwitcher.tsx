import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Project } from '@/lib/api/endpoints/projects';
import { useSession } from '@/lib/auth-client';
import { useTeamsQuery } from '@/services/teams.service';
import { useWorkspacesQuery } from '@/services/workspaces.service';
import { qk } from '@/services/queryKeys';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { SidebarMenu, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import ProjectSwitcherTrigger from './ProjectSwitcherTrigger';
import ProjectSwitcherMenu from './ProjectSwitcherMenu';
import { useProjectSwitcherPreferences } from './hooks/useProjectSwitcherPreferences';

export default function ProjectSwitcher({
  projects,
  currentProjectKey,
  onSelectProject,
}: {
  projects: Project[];
  currentProjectKey: string | null;
  onSelectProject: (key: string) => void;
}) {
  const { isMobile } = useSidebar();
  const teamsQuery = useTeamsQuery();
  const teams = teamsQuery.data ?? [];
  const workspaces = useWorkspacesQuery().data ?? [];
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const preferences = useProjectSwitcherPreferences(session?.user.id);
  const current = projects.find((project) => project.ref === currentProjectKey);
  const [open, setOpen] = useState(false);
  const [openTeams, setOpenTeams] = useState<Record<number, boolean>>({});
  const [pickedWorkspaceId, setPickedWorkspaceId] = useState<number | null>(null);

  // A project reaches its workspace through its team, so nothing is narrowed until the
  // teams have loaded.
  const currentWorkspaceId = teams.find((team) => team.id === current?.teamId)?.workspaceId;
  const workspace = teamsQuery.data
    ? (workspaces.find((entry) => entry.id === (pickedWorkspaceId ?? currentWorkspaceId)) ??
      workspaces[0])
    : undefined;
  const workspaceTeams = workspace
    ? teams.filter((team) => team.workspaceId === workspace.id)
    : teams;
  const workspaceTeamIds = new Set(workspaceTeams.map((team) => team.id));
  const workspaceProjects = workspace
    ? projects.filter((project) => workspaceTeamIds.has(project.teamId))
    : projects;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover
          modal={isMobile}
          open={open}
          onOpenChange={(value) => {
            setOpen(value);
            if (!value) return;
            setPickedWorkspaceId(null);
            void queryClient.invalidateQueries({ queryKey: qk.projects });
          }}
        >
          <PopoverTrigger asChild>
            <ProjectSwitcherTrigger current={current} />
          </PopoverTrigger>
          <ProjectSwitcherMenu
            projects={workspaceProjects}
            teams={workspaceTeams}
            workspaces={workspaces}
            workspace={workspace}
            onPickWorkspace={setPickedWorkspaceId}
            current={current}
            preferences={preferences}
            openTeams={openTeams}
            onOpenTeam={(teamId, value) => setOpenTeams((prev) => ({ ...prev, [teamId]: value }))}
            onSelectProject={(key) => {
              setOpen(false);
              onSelectProject(key);
            }}
            onClose={() => setOpen(false)}
          />
        </Popover>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
