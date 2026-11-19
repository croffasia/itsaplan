'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { WeeklyReportSettings } from '@/lib/api/endpoints/weeklyReports';
import { useSetWeeklyReportSettings } from '@/services/weeklyReports.service';

const empty = {
  levelOneTypeId: 0,
  levelTwoTypeId: 0,
  levelThreeTypeId: 0,
  levelTwoWeightId: 0,
  levelThreeWeightId: 0,
  completionRateId: 0,
  levelTwoReasonId: 0,
  levelThreeReasonId: 0,
  timeZone: 'UTC',
} satisfies WeeklyReportSettings;

export default function SettingsWeeklyReportForm({
  project,
  current,
  editable,
}: {
  project: ProjectDetail;
  current: WeeklyReportSettings | null;
  editable: boolean;
}) {
  const t = useTranslations('documents.weeklyReport');
  const common = useTranslations('common');
  const save = useSetWeeklyReportSettings(project.project.ref);
  const [draft, setDraft] = useState<WeeklyReportSettings | null>(null);
  const settings = draft ?? current ?? empty;
  const typeIds = [settings.levelOneTypeId, settings.levelTwoTypeId, settings.levelThreeTypeId];
  const options = (typeId: number, fieldType: 'text' | 'number') =>
    project.customFields.filter(
      (field) =>
        field.fieldType === fieldType &&
        (field.issueTypeId === null || field.issueTypeId === typeId),
    );
  const fields = {
    levelOneTypeId: project.issueTypes,
    levelTwoTypeId: project.issueTypes,
    levelThreeTypeId: project.issueTypes,
    levelTwoWeightId: options(settings.levelTwoTypeId, 'number'),
    levelThreeWeightId: options(settings.levelThreeTypeId, 'number'),
    completionRateId: options(settings.levelThreeTypeId, 'number'),
    levelTwoReasonId: options(settings.levelTwoTypeId, 'text'),
    levelThreeReasonId: options(settings.levelThreeTypeId, 'text'),
  };
  const keys = Object.keys(fields) as (keyof typeof fields)[];
  const canSave =
    draft !== null &&
    new Set(typeIds).size === typeIds.length &&
    settings.levelThreeWeightId !== settings.completionRateId &&
    settings.timeZone.trim().length > 0 &&
    keys.every((key) => fields[key].some((item) => item.id === settings[key]));

  return (
    <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
      {keys.map((key) => (
        <div key={key} className="space-y-2">
          {editable ? (
            <>
              <Label htmlFor={`weekly-report-${key}`}>{t(key)}</Label>
              <select
                id={`weekly-report-${key}`}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                value={settings[key]}
                onChange={(event) => setDraft({ ...settings, [key]: Number(event.target.value) })}
              >
                <option value={0}>{t('choose')}</option>
                {fields[key].map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <p className="text-sm">
              {t(key)} ·{' '}
              {fields[key].find(({ id }) => id === settings[key])?.name ?? t('unavailable')}
            </p>
          )}
        </div>
      ))}
      {editable ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="weekly-report-time-zone">{t('timeZone')}</Label>
            <Input
              id="weekly-report-time-zone"
              value={settings.timeZone}
              maxLength={64}
              onChange={(event) => setDraft({ ...settings, timeZone: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              size="sm"
              disabled={!canSave || save.isPending}
              onClick={() =>
                save.mutate(
                  { ...settings, timeZone: settings.timeZone.trim() },
                  {
                    onSuccess: () => {
                      setDraft(null);
                      toast.success(t('settingsSaved'));
                    },
                  },
                )
              }
            >
              {common('save')}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm">
          {t('timeZone')} · {current?.timeZone ?? t('unavailable')}
        </p>
      )}
    </div>
  );
}
