import Link from 'next/link';
import { FileText, Loader2, Lock, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { IssueDocumentLink } from '@/lib/api/endpoints/documents';
import ArchivedBadge from '@/components/common/ArchivedBadge';
import { Button } from '@/components/ui/button';
import { documentPath } from '@/utils/paths';
import { cn } from '@/lib/utils';

// The Docs pages linked to one owner — a work item or an initiative — with the
// loading, error and empty states around them. The owner's own heading and the
// picker that adds a link stay with the caller.
export default function DocumentLinkList({
  namespace,
  projectKey,
  links,
  canUnlink,
  unlinkingId,
  onUnlink,
  className,
}: {
  // Both catalogues carry the same keys; the wording differs per owner.
  namespace: 'issue.documents' | 'initiatives.documents';
  projectKey: string;
  links: {
    isLoading: boolean;
    isError: boolean;
    data?: IssueDocumentLink[];
    refetch: () => unknown;
  };
  canUnlink: boolean;
  // The page whose unlink is in flight, so only its button spins.
  unlinkingId: number | null;
  onUnlink: (documentId: number) => void;
  className?: string;
}) {
  const t = useTranslations(namespace);

  if (links.isLoading) {
    return (
      <div className={cn('flex h-12 items-center justify-center text-muted-foreground', className)}>
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  if (links.isError) {
    return (
      <button
        type="button"
        className={cn(
          'w-full rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground hover:text-foreground',
          className,
        )}
        onClick={() => void links.refetch()}
      >
        {t('loadFailed')}
      </button>
    );
  }

  if (!links.data?.length) {
    return (
      <p
        className={cn(
          'rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground',
          className,
        )}
      >
        {t('empty')}
      </p>
    );
  }

  return (
    <div className={cn('-mx-2 flex flex-col', className)}>
      {links.data.map((link) => (
        <div
          key={link.documentId}
          className="group flex min-h-9 items-center gap-2.5 rounded-md px-2 hover:bg-accent/50"
        >
          <Link
            href={documentPath(projectKey, link.documentId)}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="grid size-4 shrink-0 place-items-center text-sm leading-none text-muted-foreground/70">
              {link.icon || <FileText className="size-4" />}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm" dir="auto">
              {link.title.trim() || t('untitled')}
            </span>
            {link.isPrivate && <Lock className="size-3.5 text-muted-foreground" />}
            {link.archived && <ArchivedBadge />}
          </Link>
          {canUnlink && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="shrink-0 text-muted-foreground/70 opacity-100 hover:text-destructive sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
              aria-label={t('remove', { title: link.title || t('untitled') })}
              disabled={unlinkingId !== null}
              onClick={() => onUnlink(link.documentId)}
            >
              {unlinkingId === link.documentId ? <Loader2 className="animate-spin" /> : <X />}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
