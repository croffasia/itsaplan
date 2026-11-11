import { useTranslations } from 'next-intl';
import { Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import { PRO_URL } from '@/utils/app';

const ITEMS = [
  'hierarchy',
  'initiatives',
  'sprints',
  'content',
  'time',
  'fields',
  'people',
] as const;

// The Jira tab of an edition without the Jira import: what that import brings.
export default function SettingsImportExportJiraPreview() {
  const t = useTranslations('settings.importExport.jiraPreview');
  const tCommon = useTranslations('common');

  return (
    <SettingsSection title={t('title')} description={t('description')}>
      <SettingsCard className="space-y-4 p-4">
        <ul className="space-y-2 text-sm">
          {ITEMS.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              {t(`items.${item}`)}
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" asChild>
          <a href={PRO_URL} target="_blank" rel="noreferrer">
            {tCommon('aboutCloudAndPro')}
            <ExternalLink />
          </a>
        </Button>
      </SettingsCard>
    </SettingsSection>
  );
}
