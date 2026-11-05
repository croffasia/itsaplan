'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { Workspace, WorkspacePatch } from '@/lib/api/endpoints/workspaces';
import { useUpdateWorkspace } from '@/services/workspaces.service';
import OnOffStatus from '@/components/common/fields/OnOffStatus';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';

// Each control saves on change. The page's Save button does not cover them.
export default function WorkspaceSharingSection({ workspace }: { workspace: Workspace }) {
  const t = useTranslations('teams.workspace.sharing');
  const update = useUpdateWorkspace(workspace.id);
  const isOwner = workspace.role === 'owner';
  const open = workspace.sharingAvailable && workspace.sharingEnabled;
  const selected = workspace.sharingTeams.filter((team) => team.selected).map((team) => team.id);

  async function save(patch: WorkspacePatch) {
    try {
      await update.mutateAsync(patch);
      toast.success(t('saved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <SettingsSection title={t('title')} description={t('description')}>
      <SettingsCard className="divide-y divide-border/60">
        <SettingsRow
          title={t('enabled')}
          description={t('enabledHint')}
          note={workspace.sharingAvailable ? undefined : t('instanceOff')}
          control={
            workspace.sharingAvailable ? (
              <Switch
                checked={workspace.sharingEnabled}
                disabled={update.isPending}
                onCheckedChange={(sharingEnabled) => void save({ sharingEnabled })}
              />
            ) : (
              <OnOffStatus on={false}>{t('statusOff')}</OnOffStatus>
            )
          }
        />
        {open && (
          <SettingsRow
            title={t('teamsOnly')}
            description={isOwner ? t('teamsOnlyHint') : t('ownerOnly')}
            control={
              isOwner ? (
                <Switch
                  checked={workspace.sharingTeamsOnly}
                  disabled={update.isPending}
                  onCheckedChange={(sharingTeamsOnly) => void save({ sharingTeamsOnly })}
                />
              ) : (
                <OnOffStatus on={workspace.sharingTeamsOnly}>
                  {t(workspace.sharingTeamsOnly ? 'statusOn' : 'statusOff')}
                </OnOffStatus>
              )
            }
          />
        )}
        {open &&
          workspace.sharingTeamsOnly &&
          workspace.sharingTeams.map((team) =>
            isOwner ? (
              <label key={team.id} className="flex items-center gap-3 p-4 text-sm">
                <Checkbox
                  checked={team.selected}
                  disabled={update.isPending}
                  onCheckedChange={(checked) =>
                    void save({
                      sharingTeamIds: checked
                        ? [...selected, team.id]
                        : selected.filter((id) => id !== team.id),
                    })
                  }
                />
                {team.name}
              </label>
            ) : (
              <OnOffStatus key={team.id} on={team.selected} className="p-4">
                {team.name}
              </OnOffStatus>
            ),
          )}
      </SettingsCard>
    </SettingsSection>
  );
}
