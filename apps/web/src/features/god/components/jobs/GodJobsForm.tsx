'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import GodSectionPage from '../GodSectionPage';
import GodJobsSection from './GodJobsSection';
import { useUpdateInstanceJobSettings } from '../../services/god.service';
import {
  JOB_FIELD_PATHS,
  JOB_GROUPS,
  jobFormValid,
  leaseTooShort,
  toJobSettings,
  type JobFieldPath,
  type JobForm,
} from '../../utils/jobFields';

export default function GodJobsForm({ settings }: { settings: JobForm }) {
  const t = useTranslations('god.jobs');
  const tCommon = useTranslations('common');
  const update = useUpdateInstanceJobSettings();
  const [form, setForm] = useState(settings);

  const dirty = JOB_FIELD_PATHS.some((path) => form[path] !== settings[path]);
  const notes: Partial<Record<JobFieldPath, string>> = {};
  // Both sides of a broken pair get a note, so whichever field was just edited says why
  // Save is off.
  if (leaseTooShort(form, 'webhooks.leaseSeconds', 'webhooks.timeoutMs')) {
    notes['webhooks.leaseSeconds'] = t('webhookLeaseNote');
    notes['webhooks.timeoutMs'] = t('webhookTimeoutNote');
  }
  for (const lease of ['agentRuns.leaseSeconds', 'agentChat.leaseSeconds'] as const) {
    if (leaseTooShort(form, lease, 'agentInvocations.timeoutMs')) {
      notes[lease] = t('agentLeaseNote');
      notes['agentInvocations.timeoutMs'] = t('invocationTimeoutNote');
    }
  }
  const valid = jobFormValid(form) && Object.keys(notes).length === 0;

  async function save() {
    try {
      await update.mutateAsync(toJobSettings(form));
      toast.success(t('saved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <GodSectionPage
      slug="jobs"
      actions={
        <Button
          size="sm"
          onClick={() => void save()}
          disabled={!dirty || !valid || update.isPending}
        >
          {update.isPending ? tCommon('saving') : tCommon('save')}
        </Button>
      }
    >
      <div className="space-y-8">
        {JOB_GROUPS.map((group) => (
          <GodJobsSection
            key={group}
            group={group}
            form={form}
            notes={notes}
            onChange={(path, value) => setForm((f) => ({ ...f, [path]: value }))}
          />
        ))}
      </div>
    </GodSectionPage>
  );
}
