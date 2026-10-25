'use client';

import Link from 'next/link';
import { ArrowUpRight, Check, ChevronDown, FileText, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { documentPath } from '@/utils/paths';

export default function DocumentBreadcrumbMenu({
  projectKey,
  label,
  href,
  pages,
  currentId,
  createLabel,
  onCreate,
  current = false,
  className,
}: {
  projectKey: string;
  label: string;
  href?: string;
  pages: ProjectDocumentSummary[];
  currentId: number;
  createLabel: string;
  onCreate?: () => void;
  current?: boolean;
  className?: string;
}) {
  const t = useTranslations('documents');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex min-w-0 items-center gap-1 rounded-sm px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:bg-muted data-[state=open]:text-foreground',
          current && 'font-medium text-foreground',
          className,
        )}
        aria-current={current ? 'page' : undefined}
        title={label}
      >
        <span className="truncate" dir="auto">
          {label}
        </span>
        <ChevronDown className="size-3 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {href && (
          <DropdownMenuItem asChild>
            <Link href={href}>
              <span className="min-w-0 flex-1 truncate" dir="auto">
                {label}
              </span>
              <ArrowUpRight />
            </Link>
          </DropdownMenuItem>
        )}
        {href && pages.length > 0 && <DropdownMenuSeparator />}
        {pages.map((page) => (
          <DropdownMenuItem key={page.id} asChild>
            <Link
              href={documentPath(projectKey, page.id)}
              aria-current={page.id === currentId ? 'page' : undefined}
            >
              <span
                className="grid size-4 shrink-0 place-items-center text-sm leading-none"
                aria-hidden
              >
                {page.icon ? page.icon : <FileText />}
              </span>
              <span className="min-w-0 flex-1 truncate" dir="auto">
                {page.title.trim() || t('untitled')}
              </span>
              {page.id === currentId && <Check />}
            </Link>
          </DropdownMenuItem>
        ))}
        {onCreate && (href || pages.length > 0) && <DropdownMenuSeparator />}
        {onCreate && (
          <DropdownMenuItem onSelect={onCreate}>
            <Plus />
            {createLabel}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
