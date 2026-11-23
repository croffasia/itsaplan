import Link from 'next/link';
import { Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DocumentIssueLink } from '@/lib/api/endpoints/documents';
import { Button } from '@/components/ui/button';
import { issuePath } from '@/utils/paths';

// A work item linked to the page, with the unlink button where the user may change links.
export default function DocumentWorkItemRow({
  projectKey,
  item,
  removing,
  disabled,
  onRemove,
}: {
  projectKey: string;
  item: DocumentIssueLink;
  removing: boolean;
  disabled: boolean;
  onRemove?: () => void;
}) {
  const t = useTranslations('documents');
  const tCommon = useTranslations('common');

  return (
    <li className="group -mx-2 flex min-h-9 items-center gap-2.5 rounded-md ps-2 pe-1 text-[13px] transition-colors hover:bg-accent">
      <Link
        href={issuePath(projectKey, item.sequenceNumber)}
        className="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="shrink-0 font-mono text-xs font-medium text-muted-foreground" dir="ltr">
          {item.identifier}
        </span>
        <span className="min-w-0 flex-1 truncate" dir="auto">
          {item.title}
        </span>
        {item.archived && (
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[11px] text-muted-foreground">
            {tCommon('archived')}
          </span>
        )}
      </Link>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-6.5 text-muted-foreground transition-opacity hover:text-destructive md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
          aria-label={t('linkWorkItem.remove', { identifier: item.identifier })}
          title={t('linkWorkItem.remove', { identifier: item.identifier })}
          disabled={disabled}
          onClick={onRemove}
        >
          {removing ? <Loader2 className="animate-spin" /> : <X />}
        </Button>
      )}
    </li>
  );
}
