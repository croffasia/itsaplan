import { useTranslations } from 'next-intl';
import type { ImportEntityType, ImportJob } from '@/lib/api/endpoints/importJobs';

const ENTITY_ORDER: ImportEntityType[] = [
  'issue',
  'comment',
  'label',
  'state',
  'cycle',
  'attachment',
];

// Per-entity progress: how many the discover phase found in Plane against how many
// exist here so far. Attachment counts are metadata captured during create, not
// downloaded bytes — the job never transfers attachment content.
export default function SettingsImportExportJobCounts({ counts }: { counts: ImportJob['counts'] }) {
  const t = useTranslations('settings.importExport');
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-6">
        {ENTITY_ORDER.map((type) => (
          <div
            key={type}
            className="flex items-center justify-between gap-2 rounded bg-background/60 px-2 py-1 text-xs"
          >
            <span className="text-muted-foreground">{t(`entities.${type}`)}</span>
            <span className="font-medium">
              {counts[type].created}/{counts[type].discovered}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{t('countsLegend')}</p>
    </div>
  );
}
