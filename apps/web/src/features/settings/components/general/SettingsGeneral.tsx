import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import type { GeneralForm } from '../../hooks/useGeneralForm';

// The Project block of the General page. The key is shown read-only: it prefixes
// every issue and cannot change. Only an owner may edit; others see the values
// read-only.
export default function SettingsGeneral({ form }: { form: GeneralForm }) {
  const t = useTranslations('settings.general');
  const tCommon = useTranslations('common');

  return (
    <SettingsSection title={t('project')} description={t('projectHint')}>
      <SettingsCard className="space-y-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="project-key">{t('key')}</Label>
          <Input id="project-key" value={form.key} disabled readOnly />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="project-name">{tCommon('name')}</Label>
          <Input
            id="project-name"
            value={form.name}
            onChange={(e) => form.setName(e.target.value)}
            disabled={!form.editable}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="project-description">{tCommon('description')}</Label>
          <Textarea
            id="project-description"
            rows={3}
            maxLength={2000}
            value={form.description}
            onChange={(e) => form.setDescription(e.target.value)}
            disabled={!form.editable}
          />
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
