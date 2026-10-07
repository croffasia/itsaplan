'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  useCreateImportJob,
  useTestLinearStatesPreview,
  useTestPlaneStatesPreview,
} from '../../services/settings.service';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SettingsCard from '@/components/common/page/SettingsCard';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SettingsImportExportStateOverrideRow from './SettingsImportExportStateOverrideRow';
import type {
  LinearImportJobFields,
  LinearTeamOption,
  PlaneConnectionInput,
  PlaneImportJobFields,
  PlaneProjectOption,
  StateCategory,
  UnmatchedUserPolicy,
} from '@/lib/api/endpoints/importExport';

// What is about to be imported: one Plane project, or one Linear team's project
// (projectId) or its issues with no project (projectId null).
export type ImportReviewTarget =
  | { source: 'plane'; connection: PlaneConnectionInput; project: PlaneProjectOption }
  | { source: 'linear'; apiToken: string; team: LinearTeamOption; projectId: string | null };

function jobFields(target: ImportReviewTarget): PlaneImportJobFields | LinearImportJobFields {
  if (target.source === 'plane') {
    return {
      source: 'plane',
      baseUrl: target.connection.baseUrl,
      workspaceSlug: target.connection.workspaceSlug,
      apiToken: target.connection.apiToken,
      planeProjectId: target.project.id,
      planeProjectKey: target.project.identifier,
    };
  }
  const team = { apiToken: target.apiToken, teamId: target.team.id, teamKey: target.team.key };
  return target.projectId
    ? { source: 'linear', ...team, projectFilter: 'project', projectId: target.projectId }
    : { source: 'linear', ...team, projectFilter: 'none' };
}

// Shown once a source project is picked, before the job is created: the states
// the source reports for it, each pre-filled with the category itsaplan would map it
// to automatically, and the unmatched-assignee/comment-author policy. Only a state
// row the user actually changes from its default is sent as an override.
export default function SettingsImportExportMappingReview({
  projectKey,
  target,
  onImported,
}: {
  projectKey: string;
  target: ImportReviewTarget;
  onImported: () => void;
}) {
  const t = useTranslations('settings.importExport');
  const planePreview = useTestPlaneStatesPreview(
    projectKey,
    target.source === 'plane'
      ? {
          baseUrl: target.connection.baseUrl,
          workspaceSlug: target.connection.workspaceSlug,
          apiToken: target.connection.apiToken,
          planeProjectId: target.project.id,
        }
      : null,
  );
  const linearPreview = useTestLinearStatesPreview(
    projectKey,
    target.source === 'linear' ? { apiToken: target.apiToken, teamId: target.team.id } : null,
  );
  const preview = target.source === 'plane' ? planePreview : linearPreview;
  const createJob = useCreateImportJob(projectKey);
  const [overrides, setOverrides] = useState<Record<string, StateCategory>>({});
  const [unmatchedUserPolicy, setUnmatchedUserPolicy] = useState<UnmatchedUserPolicy>('unassigned');

  async function start() {
    try {
      await createJob.mutateAsync({
        ...jobFields(target),
        unmatchedUserPolicy,
        stateOverrides: overrides,
      });
      toast.success(t('importStarted'));
      onImported();
    } catch {
      // Surfaced by the global mutation error toast; nothing local to do.
    }
  }

  function setOverride(stateId: string, defaultCategory: StateCategory, category: StateCategory) {
    setOverrides((prev) => {
      if (category === defaultCategory) {
        const { [stateId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [stateId]: category };
    });
  }

  if (preview.isPending) return <ListSkeleton rows={3} rowClassName="h-10" />;

  if (preview.isError) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-muted-foreground">{t('previewFailed')}</p>
        <Button variant="outline" size="sm" onClick={() => void preview.refetch()}>
          {t('tryAgain')}
        </Button>
      </div>
    );
  }

  const states = preview.data?.states ?? [];

  return (
    <div className="space-y-6">
      {states.length > 0 && (
        <div className="space-y-2">
          <Label>{t('stateMapping')}</Label>
          <SettingsCard className="max-h-64 divide-y divide-border/60 overflow-y-auto">
            {states.map((state) => (
              <SettingsImportExportStateOverrideRow
                key={state.id}
                state={state}
                value={overrides[state.id] ?? state.category}
                onChange={(category) => setOverride(state.id, state.category, category)}
              />
            ))}
          </SettingsCard>
        </div>
      )}

      <div className="w-64 space-y-1.5">
        <Label htmlFor="unmatched-user-policy">{t('unmatchedUserPolicyLabel')}</Label>
        <Select
          value={unmatchedUserPolicy}
          onValueChange={(value) => setUnmatchedUserPolicy(value as UnmatchedUserPolicy)}
        >
          <SelectTrigger id="unmatched-user-policy" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">{t('unmatchedUserPolicyUnassigned')}</SelectItem>
            <SelectItem value="skip">{t('unmatchedUserPolicySkip')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button disabled={createJob.isPending} onClick={() => void start()}>
        {createJob.isPending ? t('starting') : t('startImport')}
      </Button>
    </div>
  );
}
