import { ArrowLeft } from 'lucide-react';
import { projectPath } from '@/utils/paths';
import { useSettingsNavGroups } from '@/hooks/useSettingsNavGroups';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@/components/ui/sidebar';
import SidebarNavItem from '@/components/layout/SidebarNavItem';

// The project settings sidebar body: a "Back to project" link, then the
// Configuration groups (AI Team, Workflow) as flat lists under their labels —
// every item reachable directly, no collapsing.
export default function SidebarSettingsNav({ projectKey }: { projectKey: string | null }) {
  const disabled = !projectKey;
  const { groups } = useSettingsNavGroups(projectKey);

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarNavItem
              href={projectKey ? projectPath(projectKey) : '#'}
              icon={ArrowLeft}
              label="Back to project"
              active={false}
              disabled={disabled}
            />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {groups.map((group) => (
        <SidebarGroup key={group.key}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarNavItem
                  key={item.key}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={item.active}
                  disabled={disabled}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
