import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Project } from '@/lib/api/endpoints/projects';
import { useSession } from '@/lib/auth-client';
import { useTeamsQuery } from '@/services/teams.service';
import { qk } from '@/services/queryKeys';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';
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
  const teams = useTeamsQuery().data ?? [];
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const preferences = useProjectSwitcherPreferences(session?.user.id);
  const current = projects.find((project) => project.key === currentProjectKey);
  const [open, setOpen] = useState(false);
  const [openTeams, setOpenTeams] = useState<Record<number, boolean>>({});

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover
          open={open}
          onOpenChange={(value) => {
            setOpen(value);
            if (value) void queryClient.invalidateQueries({ queryKey: qk.projects });
          }}
        >
          <PopoverTrigger asChild>
            <ProjectSwitcherTrigger current={current} />
          </PopoverTrigger>
          <ProjectSwitcherMenu
            projects={projects}
            teams={teams}
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
