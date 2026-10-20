import type { ReactNode } from 'react';
import { Clock, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Team } from '@/lib/api/endpoints/teams';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ProjectSwitcherScope } from './ProjectSwitcher';

export default function ProjectSwitcherNavScopes({
  teams,
  scope,
  onScopeChange,
}: {
  teams: Team[];
  scope: ProjectSwitcherScope;
  onScopeChange: (scope: ProjectSwitcherScope) => void;
}) {
  const t = useTranslations('nav.projectPicker');

  function item(value: ProjectSwitcherScope, label: string, icon?: ReactNode) {
    const active = scope === value;
    return (
      <Button
        key={value}
        variant="ghost"
        size="sm"
        aria-pressed={active}
        onClick={() => onScopeChange(value)}
        className={cn(
          'h-8 w-full justify-start gap-2 px-2 font-normal',
          active ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground',
        )}
      >
        {icon}
        <span dir="auto" className="min-w-0 truncate">
          {label}
        </span>
      </Button>
    );
  }

  return (
    <div className="ms-5 mb-1.5 flex flex-col gap-0.5 border-s ps-2">
      {item('recent', t('recent'), <Clock />)}
      {teams.map((team) => item(team.id, team.name))}
      {item('hidden', t('hidden'), <EyeOff />)}
    </div>
  );
}
