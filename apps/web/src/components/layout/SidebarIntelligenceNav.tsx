import { usePathname } from 'next/navigation';
import { Brain, NotebookPen } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { braindumpPath, mindPath } from '@/utils/paths';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@/components/ui/sidebar';
import SidebarNavItem from './SidebarNavItem';

export default function SidebarIntelligenceNav({ projectKey }: { projectKey: string | null }) {
  const pathname = usePathname();
  const { can } = usePermissions();

  const showBraindump = can('braindump', 'read');
  const showMind = can('mind', 'read');
  if (!showBraindump && !showMind) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Intelligence</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {showBraindump && (
            <SidebarNavItem
              href={projectKey ? braindumpPath(projectKey) : '#'}
              icon={NotebookPen}
              label="Braindump"
              active={pathname.includes('/braindump')}
              disabled={!projectKey}
            />
          )}
          {showMind && (
            <SidebarNavItem
              href={projectKey ? mindPath(projectKey) : '#'}
              icon={Brain}
              label="Mind"
              active={pathname.includes('/mind')}
              disabled={!projectKey}
            />
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
