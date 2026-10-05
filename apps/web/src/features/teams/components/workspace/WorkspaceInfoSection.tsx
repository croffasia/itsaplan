'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { WorkspaceSectionExtras } from '@/cloud';
import type { TeamCreation, WorkspacePatch } from '@/lib/api/endpoints/workspaces';
import { useUpdateWorkspace, useWorkspaceQuery } from '@/services/workspaces.service';
import {
  workspaceInitial,
  workspaceTileClass,
  workspaceTileStyle,
} from '@/components/layout/utils/workspaceTile';
import SectionPageView from '@/components/common/page/SectionPageView';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SectionPageSkeleton from '@/components/common/skeleton/SectionPageSkeleton';
import SettingsColorField from '@/features/settings/components/crud/SettingsColorField';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import WorkspaceDeleteSection from './WorkspaceDeleteSection';

const TEAM_CREATION: TeamCreation[] = ['owner', 'managers', 'members'];
const HEX = /^#[0-9a-f]{6}$/i;

export default function WorkspaceInfoSection({ workspaceId }: { workspaceId: number }) {
  const t = useTranslations('teams.workspace');
  const tCommon = useTranslations('common');
  const workspace = useWorkspaceQuery(workspaceId).data;
  const update = useUpdateWorkspace(workspaceId);
  const [name, setName] = useState<string | null>(null);
  // An empty field clears the colour back to the neutral tile.
  const [color, setColor] = useState<string | null>(null);
  const [teamCreation, setTeamCreation] = useState<TeamCreation | null>(null);

  if (!workspace) return <SectionPageSkeleton rows={2} />;

  const isOwner = workspace.role === 'owner';
  const deletable = isOwner && workspace.deletion !== 'instance';
  const nextName = (name ?? workspace.name).trim();
  const nextColor = color === null ? workspace.color : color.trim() || null;
  const nextTeamCreation = teamCreation ?? workspace.teamCreation;
  const patch: WorkspacePatch = {
    ...(nextName !== workspace.name && { name: nextName }),
    ...(nextColor !== workspace.color && { color: nextColor }),
    ...(nextTeamCreation !== workspace.teamCreation && { teamCreation: nextTeamCreation }),
  };
  const valid = nextName !== '' && (nextColor === null || HEX.test(nextColor));
  const canSave = valid && Object.keys(patch).length > 0 && !update.isPending;

  async function save() {
    await update.mutateAsync(patch);
    setName(null);
    setColor(null);
    setTeamCreation(null);
    toast.success(t('info.saved'));
  }

  return (
    <SectionPageView
      title={t('info.title')}
      description={t('info.description')}
      actions={
        <Button size="sm" className="h-8" disabled={!canSave} onClick={() => void save()}>
          {tCommon('save')}
        </Button>
      }
    >
      <div className="space-y-10">
        <SettingsSection title={t('info.workspace')} description={t('info.workspaceHint')}>
          <SettingsCard className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="workspace-name">{tCommon('name')}</Label>
              <Input
                id="workspace-name"
                value={name ?? workspace.name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label>{t('info.color')}</Label>
              <div className="flex items-center gap-3">
                {nextColor && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setColor('')}
                  >
                    {t('info.colorReset')}
                  </Button>
                )}
                <SettingsColorField value={color ?? workspace.color ?? ''} onChange={setColor} />
                <span
                  aria-hidden
                  className={workspaceTileClass(false)}
                  style={workspaceTileStyle(nextColor && HEX.test(nextColor) ? nextColor : null)}
                >
                  {workspaceInitial(nextName || workspace.name)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label>{t('info.role')}</Label>
              <Badge variant="secondary" className="font-normal">
                {t(`roles.${workspace.role}`)}
              </Badge>
            </div>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection
          title={t('teamCreation.title')}
          description={isOwner ? t('teamCreation.description') : t('teamCreation.ownerOnly')}
          action={
            <Select
              value={nextTeamCreation}
              disabled={!isOwner}
              onValueChange={(value) => setTeamCreation(value as TeamCreation)}
            >
              <SelectTrigger className="h-8 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAM_CREATION.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`teamCreation.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <WorkspaceSectionExtras slug="general" workspace={workspace} />

        {deletable && <WorkspaceDeleteSection workspace={workspace} />}
      </div>
    </SectionPageView>
  );
}
