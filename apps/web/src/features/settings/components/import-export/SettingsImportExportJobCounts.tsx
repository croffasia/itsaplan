import { useTranslations } from 'next-intl';
import type { ImportEntityType, ImportJob } from '@/lib/api/endpoints/importExport';
import { Progress } from '@/components/ui/progress';

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
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {ENTITY_ORDER.map((type) => {
          const { created, discovered } = counts[type];
          const pct = discovered > 0 ? Math.round((created / discovered) * 100) : 0;
          return (
            <div key={type} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t(`entities.${type}`)}</span>
                <span className="font-medium">
                  {discovered > 0 ? `${created}/${discovered}` : t('countsNotDiscovered')}
                </span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">{t('countsLegend')}</p>
    </div>
  );
}
