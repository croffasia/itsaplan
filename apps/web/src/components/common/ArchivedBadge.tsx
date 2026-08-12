import { useTranslations } from 'next-intl';

// The "Archived" marker shown next to an archived issue's title wherever one can
// still be listed (search results, an issue's links).
export default function ArchivedBadge() {
  const t = useTranslations('common');
  return (
    <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase">
      {t('archived')}
    </span>
  );
}
