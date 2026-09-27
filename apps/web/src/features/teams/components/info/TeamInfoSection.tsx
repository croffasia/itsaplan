'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { TeamBillingSection } from '@/cloud';
import type { Team } from '@/lib/api/endpoints/teams';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/dates';
import { teamPath } from '@/utils/paths';
import { useUpdateTeam, useTeam } from '@/services/teams.service';
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
import { TEAM_SLUG_PATTERN } from '../../utils/teamSlug';

// Leaving is offered only where the API allows it: the last owner has nobody to hand
// the team over to, and a membership a provisioned group granted ends at the identity
// provider.
function canLeave(team: Team): boolean {
  if (team.role === 'owner' && team.ownerCount === 1) return false;
  return !(team.source === 'scim' && team.role === 'member');
}

// The team itself: the name and the URL slug its owner edits here, the caller's rank
// in it, and the way out of it. Everything it shows comes with the team list.
export default function TeamInfoSection({ teamId }: { teamId: number }) {
  const t = useTranslations('teams.info');
  const tSection = useTranslations('teams.sections.info');
  const tManage = useTranslations('teams.manage');
  const tCommon = useTranslations('common');
  const team = useTeam(teamId);
  const router = useRouter();
  const updateTeam = useUpdateTeam();
  const [draft, setDraft] = useState<string | null>(null);
  const [slugDraft, setSlugDraft] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  if (!team) return <SectionPageSkeleton rows={3} />;

  const name = draft ?? team.name;
  const slug = slugDraft ?? team.slug ?? '';
  const isOwner = team.role === 'owner';
  const trimmed = name.trim();
  const slugValue = slug.trim();
  const slugValid = TEAM_SLUG_PATTERN.test(slugValue);
  const slugError = slugValue !== '' && !slugValid;
  const changed = trimmed !== team.name || slugValue !== team.slug;
  const canSave = trimmed !== '' && slugValid && changed && !updateTeam.isPending;

  async function save() {
    const updated = await updateTeam.mutateAsync({ teamId, name: trimmed, slug: slugValue });
    setDraft(null);
    setSlugDraft(null);
    toast.success(t('saved'));
    // The path names the team by its old slug, which no longer finds it.
    if (updated.ref !== team?.ref) router.replace(teamPath(updated.ref));
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
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="team-name">{tCommon('name')}</Label>
                  <Input id="team-name" value={name} onChange={(e) => setDraft(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="team-slug">{t('slug')}</Label>
                  <Input
                    id="team-slug"
                    value={slug}
                    placeholder="acme"
                    dir="ltr"
                    aria-invalid={slugError}
                    aria-describedby="team-slug-hint"
                    onChange={(e) => setSlugDraft(e.target.value.toLowerCase())}
                  />
                  <p
                    id="team-slug-hint"
                    className={cn(
                      'text-xs',
                      slugError ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {slugError ? t('slugInvalid') : t('slugHint')}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  <Label>{tCommon('name')}</Label>
                  <span className="text-sm text-muted-foreground">{team.name}</span>
                </div>
                {team.slug && (
                  <div className="flex items-center justify-between gap-4">
                    <Label>{t('slug')}</Label>
                    <span className="text-sm text-muted-foreground">{team.slug}</span>
                  </div>
                )}
              </>
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
