import { useTranslations } from 'next-intl';
import { useTeamsQuery } from '@/services/teams.service';

// Names the teams a project template is open to: all of the workspace, none once the
// teams it was limited to are deleted, or those teams.
export function useTemplateTeamsLabel(): (teamIds: number[] | null) => string {
  const t = useTranslations('teams.templates');
  const teams = useTeamsQuery().data;
  return (teamIds) => {
    if (teamIds === null) return t('allTeams');
    if (teamIds.length === 0) return t('noTeams');
    return teamIds.flatMap((id) => teams?.find((team) => team.id === id)?.name ?? []).join(', ');
  };
}
