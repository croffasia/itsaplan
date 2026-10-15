import { useTranslations } from 'next-intl';
import { useSession } from '@/lib/auth-client';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Input } from '@/components/ui/input';
import { buildIssueBranchName, DEFAULT_BRANCH_NAME_TEMPLATE } from '@/utils/branchName';
import type { BranchNameForm } from '../../hooks/useBranchNameForm';

// The Branch names block of the Configuration page: the template Copy branch name and
// Copy prompt fill in, with the name it gives for a sample issue of this project.
export default function SettingsBranchName({
  form,
  projectKey,
}: {
  form: BranchNameForm;
  projectKey: string;
}) {
  const t = useTranslations('settings.configuration');
  const { data: session } = useSession();
  const preview = buildIssueBranchName(
    {
      identifier: `${projectKey}-42`,
      title: t('branchNameSampleTitle'),
      cycle: { name: t('branchNameSampleCycle') },
    },
    session?.user,
    form.template.trim() || DEFAULT_BRANCH_NAME_TEMPLATE,
  );

  return (
    <SettingsSection title={t('branchName')} description={t('branchNameHint')}>
      <SettingsCard className="space-y-3 p-4">
        <Input
          value={form.template}
          onChange={(e) => form.setTemplate(e.target.value)}
          placeholder={DEFAULT_BRANCH_NAME_TEMPLATE}
          disabled={!form.editable}
          maxLength={200}
          className="max-w-md font-mono text-sm"
          aria-label={t('branchName')}
        />
        <p className="text-xs text-muted-foreground">{t('branchNamePlaceholders')}</p>
        <p className="text-xs text-muted-foreground">
          {t('branchNamePreview')}{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-foreground">{preview}</code>
        </p>
      </SettingsCard>
    </SettingsSection>
  );
}
