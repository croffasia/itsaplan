import { usePathname } from 'next/navigation';
import { Instagram, Radar } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { competitorsPath, socialPath } from '@/utils/paths';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@/components/ui/sidebar';
import SidebarNavItem from './SidebarNavItem';

export default function SidebarGrowthNav({ projectKey }: { projectKey: string | null }) {
  const pathname = usePathname();
  const { can } = usePermissions();

  const showSocial = can('social', 'read');
  const showCompetitors = can('competitors', 'read');
  if (!showSocial && !showCompetitors) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Growth</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {showSocial && (
            <SidebarNavItem
              href={projectKey ? socialPath(projectKey) : '#'}
              icon={Instagram}
              label="Social"
              active={pathname.includes('/social')}
              disabled={!projectKey}
            />
          )}
          {showCompetitors && (
            <SidebarNavItem
              href={projectKey ? competitorsPath(projectKey) : '#'}
              icon={Radar}
              label="Competitors"
              active={pathname.includes('/competitors')}
              disabled={!projectKey}
            />
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
