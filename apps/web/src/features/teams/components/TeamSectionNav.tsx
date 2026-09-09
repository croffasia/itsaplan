'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Bell,
  BookText,
  Bot,
  ChartColumn,
  ChevronRight,
  FolderKanban,
  Info,
  Plug,
  Radio,
  ShieldCheck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Team } from '@/lib/api/endpoints/teams';
import { cn } from '@/lib/utils';
import { teamSectionPath, type TeamSection } from '@/utils/paths';
import { useTeamQuery } from '@/services/teams.service';
import {
  SectionNav,
  sectionNavIdleClass,
  sectionNavItemClass,
  type SectionNavItem,
} from '@/components/common/page/SectionNav';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// The sections of the open team, as the page's second rail: the team itself, its
// projects, the roles they assign from and its members, then the AI group — the
// integration credentials the agents run on, the agents themselves, the skills they
// load, the tools they can call and the dashboard of what they did — with what MCP
// clients reach and the notification providers last. The counts come with the team
// list, so each is shown before its section is opened. A section the caller may not
// read is left out, and the AI group with it once none of them is readable.
export default function TeamSectionNav({ team }: { team: Team }) {
  const t = useTranslations('teams.sections');
  const tNav = useTranslations('nav');
  const pathname = usePathname();
  const permissions = useTeamQuery(team.id).data?.permissions;

  function section(
    id: TeamSection,
    label: string,
    icon: LucideIcon,
    count?: number,
  ): SectionNavItem {
    return {
      id,
      label,
      icon,
      badge: count === undefined ? undefined : String(count),
      href: teamSectionPath(team.id, id),
    };
  }

  const runsTeam = team.role === 'owner' || team.role === 'manager';
  const top = [
    section('info', t('info.title'), Info),
    section('projects', t('projects.title'), FolderKanban, team.projectCount),
    // The roles are managed by the team's owner and managers, so the section is theirs.
    ...(runsTeam ? [section('roles', t('roles.title'), ShieldCheck, team.roleCount)] : []),
    section('members', t('members.title'), Users, team.memberCount),
  ];
  const ai = [
    ...(permissions?.integrations.read
      ? [section('integrations', t('integrations.title'), Plug, team.integrationCount)]
      : []),
    ...(permissions?.ai_agents.read
      ? [section('ai-agents', t('agents.title'), Bot, team.agentCount)]
      : []),
    ...(permissions?.agent_skills.read
      ? [section('agent-skills', t('agentSkills.title'), BookText, team.skillCount)]
      : []),
    ...(permissions?.agent_tools.read
      ? [section('agent-tools', t('agentTools.title'), Wrench, team.toolCount)]
      : []),
    // The dashboard covers every project the team's agents work in, so it follows the
    // rank in the team the way the roles section does, not a project role.
    ...(runsTeam ? [section('analytics', t('analytics.title'), ChartColumn)] : []),
  ];
  // The notification providers are the owner's: nobody else reads or writes them.
  const bottom = [
    section('mcp', t('mcp.title'), Radio),
    ...(team.role === 'owner' ? [section('notifications', t('notifications.title'), Bell)] : []),
  ];

  const activeId = [...top, ...ai, ...bottom].find((entry) => entry.href === pathname)?.id ?? null;
  const aiActive = ai.some((entry) => entry.id === activeId);
  // Null until the user opens or closes the group themselves; until then it follows
  // whichever section is open.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const aiOpen = toggled ?? aiActive;

  return (
    <div className="space-y-2">
      <h2 className="truncate px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {team.name}
      </h2>
      <div className="space-y-0.5">
        <SectionNav sections={top} activeId={activeId} label={team.name} />
        {ai.length > 0 && (
          <Collapsible open={aiOpen} onOpenChange={setToggled}>
            <CollapsibleTrigger className={cn(sectionNavItemClass, sectionNavIdleClass)}>
              <Bot className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{tNav('aiTeam')}</span>
              <ChevronRight
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition-transform duration-150',
                  aiOpen && 'rotate-90',
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="ps-4">
              <SectionNav sections={ai} activeId={activeId} label={tNav('aiTeam')} />
            </CollapsibleContent>
          </Collapsible>
        )}
        <SectionNav sections={bottom} activeId={activeId} label={team.name} />
      </div>
    </div>
  );
}
