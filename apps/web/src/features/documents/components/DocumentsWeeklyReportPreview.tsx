import { useTranslations } from 'next-intl';
import type { WeeklyReport } from '@/lib/api/endpoints/weeklyReports';

export default function DocumentsWeeklyReportPreview({
  report,
}: {
  report: Extract<WeeklyReport, { status: 'preview' }>;
}) {
  const t = useTranslations('documents.weeklyReport');
  const progress = (value: number | null) => (value === null ? t('unavailable') : `${value}%`);

  return (
    <div className="space-y-4 text-sm">
      {report.groups.length === 0 && <p className="text-muted-foreground">{t('noTasks')}</p>}
      {report.groups.map((group) => (
        <section key={group.id} className="space-y-2 rounded-md border p-3">
          <h3 className="flex justify-between gap-3 font-semibold">
            <span dir="auto">{group.title}</span>
            <span className="shrink-0 tabular-nums">{progress(group.progress)}</span>
          </h3>
          <ul className="space-y-2 ps-3">
            {group.nodes.map((node) => (
              <li key={node.id}>
                <div className="flex justify-between gap-3">
                  <span dir="auto">{node.title}</span>
                  <span className="shrink-0 tabular-nums">{progress(node.progress)}</span>
                </div>
                {node.reasons.length > 0 && (
                  <ul className="list-disc ps-5 text-muted-foreground">
                    {node.reasons.map((reason, index) => (
                      <li key={index} dir="auto">
                        {reason}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {report.warnings.length > 0 && (
        <ul className="list-disc space-y-1 ps-5 text-muted-foreground" aria-label={t('warnings')}>
          {report.warnings.map(({ id, title, kind }) => (
            <li key={`${id}-${kind}`} dir="auto">
              {title} · {t(kind)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
