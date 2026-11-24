import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

// Every choice on these pages saves as soon as it is made, so the header says "Saving…"
// while the request runs. `saved` is what it says after one, on a page that does not
// report the outcome by a toast.
export default function AccountSaveState({ saving, saved }: { saving: boolean; saved?: string }) {
  const t = useTranslations('common');
  if (!saving) return saved ? <span className="text-xs text-muted-foreground">{saved}</span> : null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" />
      {t('saving')}
    </span>
  );
}
