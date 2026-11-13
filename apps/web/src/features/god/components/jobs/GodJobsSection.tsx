import { useTranslations } from 'next-intl';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import GodJobsField from './GodJobsField';
import {
  jobFields,
  jobValue,
  type JobFieldPath,
  type JobForm,
  type JobGroup,
} from '../../utils/jobFields';

export default function GodJobsSection({
  group,
  form,
  notes,
  onChange,
}: {
  group: JobGroup;
  form: JobForm;
  notes: Partial<Record<JobFieldPath, string>>;
  onChange: (path: JobFieldPath, value: string) => void;
}) {
  const t = useTranslations('god.jobs');

  return (
    <SettingsSection title={t(`${group}.title`)} description={t(`${group}.description`)}>
      <SettingsCard className="grid gap-6 p-4 sm:grid-cols-2">
        {jobFields(group).map((field) => (
          <GodJobsField
            key={field.path}
            field={field}
            value={form[field.path]}
            invalid={Number.isNaN(jobValue(form, field.path))}
            note={notes[field.path]}
            onChange={(value) => onChange(field.path, value)}
          />
        ))}
      </SettingsCard>
    </SettingsSection>
  );
}
