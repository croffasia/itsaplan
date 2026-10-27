'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useCreateImportJob } from '../../services/settings.service';
import { useImportReviewPreview } from '../../hooks/useImportReviewPreview';
import {
  importJobFields,
  type ImportReviewTarget,
  type TrelloImportChoices,
} from '../../utils/importJobFields';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import SettingsCard from '@/components/common/page/SettingsCard';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SettingsImportExportStateOverrideRow from './SettingsImportExportStateOverrideRow';
import SettingsImportExportUnmatchedUserPolicy from './SettingsImportExportUnmatchedUserPolicy';
import SettingsImportExportTrelloOptions from './SettingsImportExportTrelloOptions';
import type { StateCategory, UnmatchedUserPolicy } from '@/lib/api/endpoints/importExport';

// Shown once a source project is picked, before the job is created: the states
// the source reports for it, each pre-filled with the category itsaplan would map it
// to automatically, and how people are matched. Only a state row the user actually
// changes from its default is sent as an override.
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
  const preview = useImportReviewPreview(projectKey, target);
  const createJob = useCreateImportJob(projectKey);
  const [overrides, setOverrides] = useState<Record<string, StateCategory>>({});
  const [unmatchedUserPolicy, setUnmatchedUserPolicy] = useState<UnmatchedUserPolicy>('unassigned');
  const [trello, setTrello] = useState<TrelloImportChoices>({
    archivedCards: 'archive',
    memberMap: null,
  });

  async function start() {
    try {
      await createJob.mutateAsync({
        ...importJobFields(target, trello),
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

      {target.source === 'trello' ? (
        <SettingsImportExportTrelloOptions
          members={preview.data?.members ?? []}
          people={target.people}
          value={trello}
          onChange={setTrello}
        />
      ) : (
        <SettingsImportExportUnmatchedUserPolicy
          value={unmatchedUserPolicy}
          onChange={setUnmatchedUserPolicy}
        />
      )}

      <Button disabled={createJob.isPending} onClick={() => void start()}>
        {createJob.isPending ? t('starting') : t('startImport')}
      </Button>
    </div>
  );
}
