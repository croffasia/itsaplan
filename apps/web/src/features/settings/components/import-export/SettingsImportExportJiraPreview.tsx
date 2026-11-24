import { useTranslations } from 'next-intl';
import SettingsImportExportLockedPreview from './SettingsImportExportLockedPreview';

const ITEMS = [
  'hierarchy',
  'initiatives',
  'sprints',
  'content',
  'time',
  'fields',
  'people',
] as const;

export default function SettingsImportExportJiraPreview() {
  const t = useTranslations('settings.importExport.jiraPreview');

  return (
    <SettingsImportExportLockedPreview
      title={t('title')}
      description={t('description')}
      items={ITEMS.map((item) => t(`items.${item}`))}
      feature="jira-import"
    />
  );
}
