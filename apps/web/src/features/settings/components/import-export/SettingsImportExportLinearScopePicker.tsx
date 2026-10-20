import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { LinearTeamOption } from '@/lib/api/endpoints/importExport';

// The project choice for the team's issues that belong to no project. Linear ids
// are UUIDs, so it never collides with one.
export const NO_PROJECT = 'no-project';

// The teams the tested key can see, then one project of the picked team or its
// issues with no project. This component only picks; the parent shows the review.
export default function SettingsImportExportLinearScopePicker({
  teams,
  team,
  projectChoice,
  onTeamChange,
  onProjectChoiceChange,
}: {
  teams: LinearTeamOption[];
  team: LinearTeamOption | null;
  projectChoice: string | null;
  onTeamChange: (team: LinearTeamOption | null) => void;
  onProjectChoiceChange: (choice: string) => void;
}) {
  const t = useTranslations('settings.importExport');

  if (teams.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('linear.noTeams')}</p>;
  }

  return (
    <div className="flex flex-wrap gap-4">
      <div className="w-64 space-y-1.5">
        <Label htmlFor="linear-team">{t('linear.team')}</Label>
        <Select
          value={team?.id ?? ''}
          onValueChange={(id) => onTeamChange(teams.find((option) => option.id === id) ?? null)}
        >
          <SelectTrigger id="linear-team" className="w-full">
            <SelectValue placeholder={t('linear.teamPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {teams.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name} ({option.key})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {team && (
        <div className="w-64 space-y-1.5">
          <Label htmlFor="linear-project">{t('linear.project')}</Label>
          <Select value={projectChoice ?? ''} onValueChange={onProjectChoiceChange}>
            <SelectTrigger id="linear-project" className="w-full">
              <SelectValue placeholder={t('linear.projectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {team.projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
              <SelectItem value={NO_PROJECT}>{t('linear.noProject')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
