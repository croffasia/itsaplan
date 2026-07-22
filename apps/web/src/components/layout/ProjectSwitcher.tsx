import Link from 'next/link';
import { ChevronsUpDown, Plus, Settings2, SquareKanban } from 'lucide-react';
import type { Project } from '@/lib/api';
import { manageProjectsPath } from '@/utils/paths';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

// Project picker in the sidebar header, modeled on the shadcn TeamSwitcher.
export default function ProjectSwitcher({
  projects,
  currentProjectKey,
  onSelectProject,
  onNewProject,
}: {
  projects: Project[];
  currentProjectKey: string | null;
  onSelectProject: (key: string) => void;
  onNewProject: () => void;
}) {
  const { isMobile } = useSidebar();
  const current = projects.find((b) => b.key === currentProjectKey);

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
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <SquareKanban className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{current?.name ?? 'No projects yet'}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {current?.key ?? '—'}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Projects
            </DropdownMenuLabel>
            {projects.map((b, i) => (
              <DropdownMenuItem
                key={b.key}
                onClick={() => onSelectProject(b.key)}
                className="gap-2 p-2"
              >
                <Badge
                  variant="outline"
                  className="shrink-0 rounded px-1 py-0 font-mono text-[10px] text-muted-foreground"
                >
                  {b.key}
                </Badge>
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                {i < 9 && <DropdownMenuShortcut>⌘{i + 1}</DropdownMenuShortcut>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onNewProject} className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <span className="font-medium text-muted-foreground">New project</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="gap-2 p-2">
              <Link href={manageProjectsPath()}>
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <Settings2 className="size-4" />
                </div>
                <span className="font-medium text-muted-foreground">Manage projects</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
