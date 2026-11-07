'use client';

import { useTranslations } from 'next-intl';
import type { TeamProjectOption } from '@/lib/api/endpoints/teams';
import { useTeamProjectOptionsQuery, useTeamsQuery } from '@/services/teams.service';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// The team of the workspace and its project a template is saved from.
export default function WorkspaceTemplateSource({
  workspaceId,
  teamId,
  projectId,
  onTeamChange,
  onProjectChange,
}: {
  workspaceId: number;
  teamId: number | null;
  projectId: number | null;
  onTeamChange: (teamId: number) => void;
  onProjectChange: (project: TeamProjectOption) => void;
}) {
  const t = useTranslations('projects.saveTemplate');
  const teams = useTeamsQuery().data?.filter((team) => team.workspaceId === workspaceId) ?? [];
  const projects = useTeamProjectOptionsQuery(teamId).data ?? [];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="template-team">{t('team')}</Label>
        <Select
          value={teamId === null ? '' : String(teamId)}
          onValueChange={(value) => onTeamChange(Number(value))}
        >
          <SelectTrigger id="template-team" className="w-full">
            <SelectValue placeholder={t('chooseTeam')} />
          </SelectTrigger>
          <SelectContent>
            {teams.map((team) => (
              <SelectItem key={team.id} value={String(team.id)}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="template-project">{t('project')}</Label>
        <Select
          value={projectId === null ? '' : String(projectId)}
          onValueChange={(value) => {
            const project = projects.find((one) => one.id === Number(value));
            if (project) onProjectChange(project);
          }}
          disabled={teamId === null}
        >
          <SelectTrigger id="template-project" className="w-full">
            <SelectValue placeholder={t('chooseProject')} />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={String(project.id)}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
