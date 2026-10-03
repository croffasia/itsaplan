'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useUpdateWorkspace, useWorkspaceQuery } from '@/services/workspaces.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SectionPageSkeleton from '@/components/common/skeleton/SectionPageSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function WorkspaceInfoSection({ workspaceId }: { workspaceId: number }) {
  const t = useTranslations('teams.workspace');
  const tCommon = useTranslations('common');
  const workspace = useWorkspaceQuery(workspaceId).data;
  const update = useUpdateWorkspace(workspaceId);
  const [draft, setDraft] = useState<string | null>(null);

  if (!workspace) return <SectionPageSkeleton rows={2} />;

  const trimmed = (draft ?? workspace.name).trim();
  const canSave = trimmed !== '' && trimmed !== workspace.name && !update.isPending;

  async function save() {
    await update.mutateAsync(trimmed);
    setDraft(null);
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
      <SettingsSection title={t('info.workspace')} description={t('info.workspaceHint')}>
        <SettingsCard className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="workspace-name">{tCommon('name')}</Label>
            <Input
              id="workspace-name"
              value={draft ?? workspace.name}
              maxLength={60}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label>{t('info.role')}</Label>
            <Badge variant="secondary" className="font-normal">
              {t(`roles.${workspace.role}`)}
            </Badge>
          </div>
        </SettingsCard>
      </SettingsSection>
    </SectionPageView>
  );
}
