'use client';

import { useTranslations } from 'next-intl';
import { useTeamsQuery } from '@/services/teams.service';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

// Which teams of the workspace see a template: all of them, or the ones ticked. `value`
// is null for all of them.
export default function WorkspaceTemplateTeamsField({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId: number;
  value: number[] | null;
  onChange: (next: number[] | null) => void;
}) {
  const t = useTranslations('projects.saveTemplate');
  const teams = useTeamsQuery().data?.filter((team) => team.workspaceId === workspaceId) ?? [];

  return (
    <div className="space-y-2">
      <Label>{t('teams')}</Label>
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="text-sm">{t('allTeams')}</span>
          <span className="block text-xs text-muted-foreground">{t('allTeamsHint')}</span>
        </span>
        <Switch checked={value === null} onCheckedChange={(all) => onChange(all ? null : [])} />
      </label>
      {value !== null && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {teams.map((team) => (
            <label
              key={team.id}
              className="flex min-w-0 cursor-pointer items-center gap-2 text-sm text-foreground"
            >
              <Checkbox
                checked={value.includes(team.id)}
                onCheckedChange={(checked) =>
                  onChange(
                    checked === true ? [...value, team.id] : value.filter((id) => id !== team.id),
                  )
                }
              />
              <span className="truncate" dir="auto">
                {team.name}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
