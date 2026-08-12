import { Paperclip } from 'lucide-react';
import { useTranslations } from 'next-intl';

// Covers the whole modal while files are dragged over it, stating where they
// land. pointer-events-none so the drag events keep reaching the modal below.
export default function NewIssueDropOverlay({ count }: { count: number }) {
  const t = useTranslations('issue.attachments');
  let label: string;
  if (count > 0) label = t('dropCount', { count });
  // A drag does not always expose its items, leaving the count at 0.
  else label = t('drop');

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary bg-background/80 text-primary backdrop-blur-sm">
      <Paperclip className="size-6" />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{t('dropHint')}</span>
    </div>
  );
}
