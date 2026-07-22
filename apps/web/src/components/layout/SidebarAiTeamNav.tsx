import { usePathname } from 'next/navigation';
import { MessagesSquare } from 'lucide-react';
import { aiChatPath, aiTeamPath } from '@/utils/paths';
import { AI_TEAM_SECTIONS } from '@/utils/settingsSections';
import { usePermissions } from '@/hooks/usePermissions';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@/components/ui/sidebar';
import SidebarNavItem from '@/components/layout/SidebarNavItem';

// The AI Team sidebar group: the chat plus the AI Team sections the viewer may
// read. Renders nothing when none of them are readable.
export default function SidebarAiTeamNav({ projectKey }: { projectKey: string | null }) {
  const pathname = usePathname();
  const { can } = usePermissions();
  const disabled = !projectKey;

  const sections = AI_TEAM_SECTIONS.filter((s) => can(s.resource, 'read'));
  const canChat = can('ai_agents', 'read');
  if (!canChat && sections.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>AI Team</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {canChat && (
            <SidebarNavItem
              href={projectKey ? aiChatPath(projectKey) : '#'}
              icon={MessagesSquare}
              label="Chat"
              active={pathname.endsWith('/ai-team/chat')}
              disabled={disabled}
            />
          )}
          {sections.map((s) => (
            <SidebarNavItem
              key={s.slug}
              href={projectKey ? aiTeamPath(projectKey, s.slug) : '#'}
              icon={s.icon}
              label={s.label}
              active={pathname.endsWith(`/ai-team/${s.slug}`)}
              disabled={disabled}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
