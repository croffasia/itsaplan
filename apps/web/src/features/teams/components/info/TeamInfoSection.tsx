'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { TeamBillingSection } from '@/cloud';
import type { Team } from '@/lib/api';
import { formatDate } from '@/utils/dates';
import { useRenameTeam, useTeam } from '@/services/teams.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SectionPageSkeleton from '@/components/common/skeleton/SectionPageSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TeamLeadsSection from './TeamLeadsSection';
import TeamLeaveDialog from './TeamLeaveDialog';

// Leaving is offered only where the API allows it: the last owner has nobody to hand
// the team over to, and a membership a provisioned group granted ends at the identity
// provider.
function canLeave(team: Team): boolean {
  if (team.role === 'owner' && team.ownerCount === 1) return false;
  return !(team.source === 'scim' && team.role === 'member');
}

// The team itself: the name its owner edits here, the caller's rank in it, and the
// way out of it. Everything it shows comes with the team list.
export default function TeamInfoSection({ teamId }: { teamId: number }) {
  const t = useTranslations('teams.info');
  const tSection = useTranslations('teams.sections.info');
  const tManage = useTranslations('teams.manage');
  const tCommon = useTranslations('common');
  const team = useTeam(teamId);
  const renameTeam = useRenameTeam();
  const [draft, setDraft] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  if (!team) return <SectionPageSkeleton rows={3} />;

  const name = draft ?? team.name;
  const isOwner = team.role === 'owner';
  const trimmed = name.trim();
  const canSave = trimmed !== '' && trimmed !== team.name && !renameTeam.isPending;

  async function save() {
    await renameTeam.mutateAsync({ teamId, name: trimmed });
    setDraft(null);
    toast.success(t('saved'));
  }

  return (
    <SectionPageView
      title={tSection('title')}
      description={tSection('description')}
      actions={
        isOwner ? (
          <Button size="sm" className="h-8" disabled={!canSave} onClick={() => void save()}>
            {tCommon('save')}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-10">
        <SettingsSection title={t('team')} description={t('teamHint')}>
          <SettingsCard className="space-y-4 p-4">
            {isOwner ? (
              <div className="space-y-1.5">
                <Label htmlFor="team-name">{tCommon('name')}</Label>
                <Input id="team-name" value={name} onChange={(e) => setDraft(e.target.value)} />
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <Label>{tCommon('name')}</Label>
                <span className="text-sm text-muted-foreground">{team.name}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <Label>{t('role')}</Label>
              <Badge variant="secondary" className="font-normal">
                {tManage(`roles.${team.role}`)}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label>{t('created')}</Label>
              <span className="text-sm text-muted-foreground">{formatDate(team.createdAt)}</span>
            </div>
          </SettingsCard>
        </SettingsSection>

        <TeamLeadsSection teamId={teamId} />

        <TeamBillingSection teamId={teamId} />

        {canLeave(team) && (
          <SettingsSection
            title={tManage('leaveAction')}
            description={t('leaveHint')}
            action={
              <Button variant="outline" size="sm" className="h-8" onClick={() => setLeaving(true)}>
                {tManage('leaveAction')}
              </Button>
            }
          />
        )}
      </div>

      {leaving && <TeamLeaveDialog team={team} onClose={() => setLeaving(false)} />}
    </SectionPageView>
  );
}
