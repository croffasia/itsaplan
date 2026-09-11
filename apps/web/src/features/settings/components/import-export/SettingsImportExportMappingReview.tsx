'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useCreateImportJob, useTestPlaneStatesPreview } from '../../services/settings.service';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SettingsImportExportStateOverrideRow from './SettingsImportExportStateOverrideRow';
import type {
  PlaneProjectOption,
  StateCategory,
  UnmatchedUserPolicy,
} from '@/lib/api/endpoints/importJobs';
import type { PlaneConnection } from './SettingsImportExport';

// Shown once a source project is picked, before the job is created: the states
// Plane reports for it, each pre-filled with the category itsaplan would map it to
// automatically, and the unmatched-assignee/comment-author policy. Only a state row
// the user actually changes from its default is sent as an override.
export default function SettingsImportExportMappingReview({
  projectKey,
  connection,
  selected,
  onImported,
}: {
  projectKey: string;
  connection: PlaneConnection;
  selected: PlaneProjectOption;
  onImported: () => void;
}) {
  const t = useTranslations('settings.importExport');
  const preview = useTestPlaneStatesPreview(projectKey, {
    baseUrl: connection.baseUrl,
    workspaceSlug: connection.workspaceSlug,
    apiToken: connection.apiToken,
    planeProjectId: selected.id,
  });
  const createJob = useCreateImportJob(projectKey);
  const [overrides, setOverrides] = useState<Record<string, StateCategory>>({});
  const [unmatchedUserPolicy, setUnmatchedUserPolicy] = useState<UnmatchedUserPolicy>('unassigned');

  async function start() {
    try {
      await createJob.mutateAsync({
        baseUrl: connection.baseUrl,
        workspaceSlug: connection.workspaceSlug,
        apiToken: connection.apiToken,
        planeProjectId: selected.id,
        planeProjectKey: selected.identifier,
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
          <div className="space-y-2">
            {states.map((state) => (
              <SettingsImportExportStateOverrideRow
                key={state.id}
                state={state}
                value={overrides[state.id] ?? state.category}
                onChange={(category) => setOverride(state.id, state.category, category)}
              />
            ))}
          </div>
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
