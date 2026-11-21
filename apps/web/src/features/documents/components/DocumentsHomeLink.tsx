'use client';

import type { ReactNode } from 'react';
import { FileText, LockKeyhole, Users } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { cn } from '@/lib/utils';
import { documentPath } from '@/utils/paths';

export default function DocumentsHomeLink({
  projectKey,
  document,
  className,
  children,
}: {
  projectKey: string;
  document: ProjectDocumentSummary;
  className?: string;
  children?: ReactNode;
}) {
  const t = useTranslations('documents');

  return (
    <Link
      href={documentPath(projectKey, document.id)}
      className={cn(
        'flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-[13px] transition-colors outline-none hover:bg-muted/65 focus-visible:ring-2 focus-visible:ring-ring/60',
        className,
      )}
    >
      <span
        className="grid size-5 shrink-0 place-items-center text-sm text-muted-foreground"
        aria-hidden
      >
        {document.icon ? document.icon : <FileText className="size-3.5" />}
      </span>
      <span className="min-w-0 flex-1 truncate" dir="auto">
        {document.title.trim() || t('untitled')}
      </span>
      {document.visibility === 'restricted' && (
        <Users className="size-3 shrink-0 text-muted-foreground" />
      )}
      {document.visibility === 'private' && (
        <LockKeyhole className="size-3 shrink-0 text-muted-foreground" />
      )}
      {children}
    </Link>
  );
}
