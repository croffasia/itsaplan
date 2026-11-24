import { useTranslations } from 'next-intl';
import SettingsImportExportLockedPreview from './SettingsImportExportLockedPreview';

const ITEMS = ['hierarchy', 'sections', 'columns', 'content', 'time', 'fields', 'people'] as const;

export default function SettingsImportExportAsanaPreview() {
  const t = useTranslations('settings.importExport.asanaPreview');

  return (
    <SettingsImportExportLockedPreview
      title={t('title')}
      description={t('description')}
      items={ITEMS.map((item) => t(`items.${item}`))}
      feature="asana-import"
    />
  );
}
