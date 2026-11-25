import { CircleSlash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// Why the issue sits in the blocked column, and the way out of it.
export default function IssueBlockedField({
  reason,
  heldByLinks,
  onUnblock,
}: {
  reason: string | null;
  // Moved in by its blocking issues, so it returns by itself once they close.
  heldByLinks: boolean;
  // Absent for a reader, or when the project has no column to return to.
  onUnblock?: () => void;
}) {
  const t = useTranslations('issue.blocked');
  return (
    <div className="flex min-w-0 items-start gap-2 pt-1 text-sm">
      <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span dir="auto" className="min-w-0 flex-1 break-words">
        {reason ?? (
          <span className="text-muted-foreground">{t(heldByLinks ? 'byLinks' : 'noReason')}</span>
        )}
      </span>
      {onUnblock && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 shrink-0 px-2 text-xs"
          onClick={onUnblock}
        >
          {t('unblock')}
        </Button>
      )}
    </div>
  );
}
